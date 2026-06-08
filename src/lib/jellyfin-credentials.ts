import { db } from '@/lib/db'

/**
 * Jellyfin Credentials Helper
 *
 * On Vercel serverless, in-memory state is lost between invocations.
 * This helper ensures we always have credentials by:
 * 1. Checking the database first (persisted from a previous connection)
 * 2. If no credentials exist, auto-connecting from environment variables
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

// Known server ID (consistent identifier for the Jellyfin server)
const JELLYFIN_SERVER_ID = '363ac50118644e63bddcd34c6dc063a9'

/**
 * Get Jellyfin credentials from DB, or auto-connect from env vars if none exist.
 * This is the primary way all API routes should obtain credentials.
 */
export async function getJellyfinCredentials(): Promise<JellyfinCreds | null> {
  // Step 1: Try database for existing credentials
  try {
    const server = await db.jellyfinServer.findFirst()
    if (server && server.connected && server.accessToken) {
      return {
        serverUrl: server.serverUrl,
        userId: server.userId,
        accessToken: server.accessToken,
        username: server.username,
        connected: true,
        serverId: JELLYFIN_SERVER_ID,
      }
    }
  } catch (dbError) {
    console.error('DB lookup failed for Jellyfin credentials (will try auto-connect):', dbError)
    // DB might be unavailable — fall through to auto-connect
  }

  // Step 2: No credentials in DB — try auto-connect from env vars
  return await autoConnectFromEnv()
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
        'X-Emby-Authorization': `Emby Client="MyTube", Device="WebBrowser", DeviceId="mytube-auto", Version="1.0.0"`,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!authResponse.ok) {
      console.error('Jellyfin auto-connect auth failed:', authResponse.status)
      return null
    }

    const authData = await authResponse.json()
    const { AccessToken, User } = authData

    if (!AccessToken || !User?.Id) {
      return null
    }

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
      serverId: JELLYFIN_SERVER_ID,
    }
  } catch (error) {
    console.error('Jellyfin auto-connect error:', error)
    return null
  }
}

/**
 * Check if Jellyfin is connected (quick check without full auth).
 */
export async function isJellyfinConnected(): Promise<boolean> {
  try {
    const server = await db.jellyfinServer.findFirst()
    if (server?.connected) return true
  } catch {
    // DB unavailable
  }

  // Check if env vars are configured
  return !!(process.env.JELLYFIN_SERVER_URL && process.env.JELLYFIN_USERNAME && process.env.JELLYFIN_PASSWORD)
}
