import { db } from '@/lib/db'

/**
 * Jellyfin Credentials Helper
 *
 * On Vercel serverless, in-memory state is lost between invocations.
 * This helper ensures we always have VALID credentials by:
 * 1. Checking the database for existing credentials (with token validation)
 * 2. If the token is invalid, trying env vars — first the direct token, then username/password auth
 * 3. Saving working credentials to the DB for future requests
 *
 * IMPORTANT: The Jellyfin /Users/AuthenticateByName endpoint may return 500
 * on some server configurations (reverse proxy, Cloudflare, etc.).
 * To work around this, you can set JELLYFIN_ACCESS_TOKEN and JELLYFIN_USER_ID
 * env vars directly, bypassing the auth endpoint entirely.
 *
 * Environment Variables:
 * - JELLYFIN_SERVER_URL  (required) — e.g. https://manitou.dyabavadra.com
 * - JELLYFIN_ACCESS_TOKEN (optional) — Pre-obtained access token, skips auth endpoint
 * - JELLYFIN_USER_ID      (optional) — User ID corresponding to the access token
 * - JELLYFIN_USERNAME     (optional) — For auth endpoint fallback
 * - JELLYFIN_PASSWORD     (optional) — For auth endpoint fallback
 */

interface JellyfinCreds {
  serverUrl: string
  userId: string
  accessToken: string
  username: string
  connected: boolean
  serverId: string
  name?: string
}

/**
 * Lightweight credentials type passed from the client side
 * (e.g. via query params) to seed the in-memory credential cache
 * on Vercel serverless where state is lost on cold start.
 */
export interface ClientCredentials {
  serverUrl: string
  userId: string
  accessToken: string
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
    console.error('DB lookup failed for Jellyfin credentials (will try env vars):', dbError)
    // DB might be unavailable — fall through to env vars
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
 *
 * Priority:
 * 1. If JELLYFIN_ACCESS_TOKEN + JELLYFIN_USER_ID are set, use them directly
 *    (bypasses the auth endpoint — needed when /Users/AuthenticateByName returns 500)
 * 2. Otherwise, try username/password authentication via the auth endpoint
 *
 * If successful, saves credentials to DB for future requests.
 */
async function autoConnectFromEnv(): Promise<JellyfinCreds | null> {
  const serverUrl = process.env.JELLYFIN_SERVER_URL
  if (!serverUrl) {
    return null
  }

  const baseUrl = serverUrl.replace(/\/+$/, '')

  // --- Priority 1: Direct token from env vars ---
  const directToken = process.env.JELLYFIN_ACCESS_TOKEN
  const directUserId = process.env.JELLYFIN_USER_ID

  if (directToken && directUserId) {
    console.log('Using JELLYFIN_ACCESS_TOKEN + JELLYFIN_USER_ID from env vars (bypassing auth endpoint)')
    const creds: JellyfinCreds = {
      serverUrl: baseUrl,
      userId: directUserId,
      accessToken: directToken,
      username: process.env.JELLYFIN_USERNAME || 'user',
      connected: true,
      serverId: '',
    }

    // Validate the direct token before using it
    const isValid = await validateToken(creds)
    if (isValid) {
      // Extract serverId from /System/Info
      try {
        const infoRes = await fetch(`${baseUrl}/System/Info`, {
          headers: { 'X-Emby-Token': directToken },
          signal: AbortSignal.timeout(5000),
        })
        if (infoRes.ok) {
          const info = await infoRes.json()
          creds.serverId = info.Id || ''
        }
      } catch {
        // Non-critical
      }

      // Save to database for future requests (non-fatal if it fails)
      await saveCredentialsToDb(creds)
      return creds
    }

    console.warn('JELLYFIN_ACCESS_TOKEN from env vars is invalid. Falling back to username/password auth.')
  }

  // --- Priority 2: Username/password authentication ---
  const username = process.env.JELLYFIN_USERNAME
  const password = process.env.JELLYFIN_PASSWORD

  if (!username || !password) {
    return null
  }

  try {
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

    const creds: JellyfinCreds = {
      serverUrl: baseUrl,
      userId: User.Id,
      accessToken: AccessToken,
      username: User.Name || username,
      connected: true,
      serverId: ServerId || '',
    }

    // Save to database for future requests (non-fatal if it fails)
    await saveCredentialsToDb(creds)
    return creds
  } catch (error) {
    console.error('Jellyfin auto-connect error:', error)
    return null
  }
}

/**
 * Save credentials to the database. Non-fatal if it fails.
 */
async function saveCredentialsToDb(creds: JellyfinCreds): Promise<void> {
  try {
    await db.jellyfinServer.deleteMany()
    await db.jellyfinServer.create({
      data: {
        name: 'My Jellyfin',
        serverUrl: creds.serverUrl,
        userId: creds.userId,
        accessToken: creds.accessToken,
        username: creds.username,
        connected: true,
        lastConnected: new Date(),
      },
    })
  } catch (dbError) {
    console.error('Failed to save Jellyfin credentials to DB (non-fatal):', dbError)
    // Continue anyway — we have the credentials for this request
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
 * Seed the in-memory credential cache from client-supplied credentials.
 * This is critical for Vercel serverless where in-memory state is lost on
 * every cold start — the client passes credentials via query params, and
 * this function makes them available to getJellyfinCredentials() without
 * needing a DB lookup or re-auth.
 */
export function setCredentialsFromClient(credentials: ClientCredentials): void {
  validatedCreds = {
    serverUrl: credentials.serverUrl,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    username: 'user',
    connected: true,
    serverId: '',
  }
  validatedAt = Date.now()
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
