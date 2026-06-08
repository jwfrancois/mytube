import { NextResponse } from 'next/server'
import { getJellyfinCredentials, forceReconnect } from '@/lib/jellyfin-credentials'

export async function POST() {
  try {
    const serverUrl = process.env.JELLYFIN_SERVER_URL
    const directToken = process.env.JELLYFIN_ACCESS_TOKEN
    const directUserId = process.env.JELLYFIN_USER_ID
    const username = process.env.JELLYFIN_USERNAME
    const password = process.env.JELLYFIN_PASSWORD

    // If no env vars are configured at all, return gracefully
    if (!serverUrl) {
      return NextResponse.json({
        success: false,
        notConfigured: true,
        error: 'Auto-connect not configured. Set JELLYFIN_SERVER_URL environment variable.',
      }, { status: 200 })
    }

    if (!directToken && !directUserId && (!username || !password)) {
      return NextResponse.json({
        success: false,
        notConfigured: true,
        error: 'Auto-connect not configured. Set JELLYFIN_ACCESS_TOKEN+JELLYFIN_USER_ID or JELLYFIN_USERNAME+JELLYFIN_PASSWORD environment variables.',
      }, { status: 200 })
    }

    // Use the credentials helper which handles both direct token and username/password auth
    const creds = await forceReconnect()

    if (!creds) {
      return NextResponse.json({
        success: false,
        error: 'Could not authenticate with Jellyfin. Check your credentials and server URL.',
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      server: {
        id: 'session',
        name: 'My Jellyfin',
        serverUrl: creds.serverUrl,
        username: creds.username,
        connected: true,
        lastConnected: new Date().toISOString(),
        serverId: creds.serverId,
      },
    })
  } catch (error) {
    console.error('Jellyfin auto-connect error:', error)
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while connecting to Jellyfin.' }, { status: 500 })
  }
}
