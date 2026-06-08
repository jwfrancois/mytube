import { db } from '@/lib/db'

/**
 * Jellyfin Credentials Helper
 *
 * On Vercel serverless, in-memory state is lost between invocations.
 * This helper ensures we always have VALID credentials by:
 * 1. Checking the database for existing credentials
 * 2. Validating the stored token with a lightweight API call
 * 3. If the token is invalid, clearing it and auto-connecting from env vars
 *
 * This replaces the old pattern of relying on in-memory caches that
 * don't survive serverless cold starts.
 */

interface JellyfinCreds {
  serverUrl: string
  userId: string
  accessToken: string
  username: string
  connected: boolean
  serverId: string
}

// In-memory cache for validated credentials (survives within a single serverless invocation)
let validatedCreds: JellyfinCreds | null = null
let validatedAt = 0
const CREDS_CACHE_MS = 60_000 // Re-validate at most once per minute

/**
 * Get Jellyfin credentials, validating the token before returning.
 * This is the primary way all API routes should obtain credentials.
 */
export async function getJellyfinCredentials(): Promise<JellyfinCreds | null> {
  // Return in-memory cached creds if recently validated
  if (validatedCreds && Date.now() - validatedAt < CREDS_CACHE_MS) {
    return validatedCreds
  }

  // Step 1: Try database for existing credentials
  try {
    const server = await db.jellyfinServer.findFirst()
    if (server && server.connected && server.accessToken) {
      const creds: JellyfinCreds = {
        serverUrl: server.serverUrl,
        userId: server.userId,
        accessToken: server.accessToken,
        username: server.username,
        connected: true,
        serverId: server.serverUrl.includes('manitou') ? '363ac50118644e63bddcd34c6dc063a9' : '',
      }

      // Step 2: Validate the token with a lightweight API call
      const isValid = await validateToken(creds)
      if (isValid) {
        validatedCreds = creds
        validatedAt = Date.now()
        return creds
      }

      // Token is invalid — clear stale DB record
      console.warn('Jellyfin token is invalid (401). Clearing stale credentials and attempting re-auth.')
      await invalidateCredentials()
    }
  } catch (dbError) {
    console.error('DB lookup failed for Jellyfin credentials (will try auto-connect):', dbError)
    // DB might be unavailable — fall through to auto-connect
  }

  // Step 3: Try auto-connect from env vars
  const newCreds = await autoConnectFromEnv()
  if (newCreds) {
    validatedCreds = newCreds
    validatedAt = Date.now()
  }
  return newCreds
}

/**
 * Validate a token by making a lightweight API call to Jellyfin.
 * Returns true if the token is valid, false otherwise.
 */
async function validateToken(creds: JellyfinCreds): Promise<boolean> {
  try {
    const res = await fetch(`${creds.serverUrl}/System/Info`, {
      headers: { 'X-Emby-Token': creds.accessToken },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    // Network error — token might be valid but server unreachable
    // Return true optimistically to avoid forcing re-auth during outages
    console.warn('Could not validate Jellyfin token (network error). Assuming valid.')
    return true
  }
}

/**
 * Clear stale credentials from the database.
 */
async function invalidateCredentials(): Promise<void> {
  try {
    await db.jellyfinServer.deleteMany()
  } catch {
    // Non-fatal
  }
  validatedCreds = null
  validatedAt = 0
}

/**
 * Auto-connect to Jellyfin using environment variables.
 * If env vars are not set, returns null.
 * If successful, saves credentials to DB for future requests.
 */
async function autoConnectFromEnv(): Promise<JellyfinCreds | null> {
  const serverUrl = process.env.JELLYFIN_SERVER_URL
  const username = process.env.JELLYFIN_USERNAME
  const password = process.env.JELLYFIN_PASSWORD

  if (!serverUrl || !username || !password) {
    return null
  }

  try {
    const baseUrl = serverUrl.replace(/\/+$/, '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const authResponse = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': `Emby Client="MyTube", Device="WebBrowser", DeviceId="mytube-auto-${Date.now()}", Version="1.0.0"`,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!authResponse.ok) {
      const errorText = await authResponse.text().catch(() => '')
      console.error('Jellyfin auto-connect auth failed:', authResponse.status, errorText.substring(0, 200))
      return null
    }

    const authData = await authResponse.json()
    const { AccessToken, User, ServerId } = authData

    if (!AccessToken || !User?.Id) {
      return null
    }

    const serverId = ServerId || ''

    // Save to database for future requests (non-fatal if it fails)
    try {
      await db.jellyfinServer.deleteMany()
      await db.jellyfinServer.create({
        data: {
          name: 'My Jellyfin',
          serverUrl: baseUrl,
          userId: User.Id,
          accessToken: AccessToken,
          username: User.Name || username,
          connected: true,
          lastConnected: new Date(),
        },
      })
    } catch (dbError) {
      console.error('Failed to save Jellyfin credentials to DB (non-fatal):', dbError)
      // Continue anyway — we have the credentials for this request
    }

    return {
      serverUrl: baseUrl,
      userId: User.Id,
      accessToken: AccessToken,
      username: User.Name || username,
      connected: true,
      serverId,
    }
  } catch (error) {
    console.error('Jellyfin auto-connect error:', error)
    return null
  }
}

/**
 * Force a re-authentication on the next getJellyfinCredentials() call.
 * Called when an API route gets a 401 from Jellyfin.
 */
export function invalidateCredentialCache(): void {
  validatedCreds = null
  validatedAt = 0
}

/**
 * Force re-connect: clear DB credentials + in-memory cache,
 * then attempt fresh authentication from env vars.
 */
export async function forceReconnect(): Promise<JellyfinCreds | null> {
  await invalidateCredentials()
  const creds = await autoConnectFromEnv()
  if (creds) {
    validatedCreds = creds
    validatedAt = Date.now()
  }
  return creds
}

/**
 * Check if Jellyfin is connected (quick check with token validation).
 */
export async function isJellyfinConnected(): Promise<boolean> {
  const creds = await getJellyfinCredentials()
  return creds !== null && creds.connected
}
