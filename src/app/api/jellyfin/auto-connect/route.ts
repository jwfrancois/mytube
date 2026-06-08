import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { mediaCache } from '@/lib/media-cache'

export async function POST() {
  try {
    const serverUrl = process.env.JELLYFIN_SERVER_URL
    const username = process.env.JELLYFIN_USERNAME
    const password = process.env.JELLYFIN_PASSWORD

    // If env vars are not configured, return gracefully (not an error)
    if (!serverUrl || !username || !password) {
      return NextResponse.json({
        success: false,
        notConfigured: true,
        error: 'Auto-connect not configured. Set JELLYFIN_SERVER_URL, JELLYFIN_USERNAME, and JELLYFIN_PASSWORD environment variables.',
      }, { status: 200 })
    }

    const baseUrl = serverUrl.replace(/\/+$/, '')

    // Authenticate with Jellyfin with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

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
      const errorText = await authResponse.text()
      console.error('Jellyfin auto-connect auth failed:', authResponse.status, errorText)
      return NextResponse.json({ success: false, error: 'Authentication failed. Check your credentials.' }, { status: 401 })
    }

    const authData = await authResponse.json()
    const { AccessToken, User } = authData

    if (!AccessToken || !User?.Id) {
      return NextResponse.json({ success: false, error: 'Invalid response from Jellyfin server' }, { status: 500 })
    }

    // Delete any existing Jellyfin servers (we only support one)
    await db.jellyfinServer.deleteMany()

    // Save the connection
    const server = await db.jellyfinServer.create({
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

    // Clear cached media data on new connection
    await mediaCache.clear()

    // Known server ID constant
    const JELLYFIN_SERVER_ID = '363ac50118644e63bddcd34c6dc063a9'

    return NextResponse.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        serverUrl: server.serverUrl,
        username: server.username,
        connected: server.connected,
        lastConnected: server.lastConnected,
        serverId: JELLYFIN_SERVER_ID,
      },
    })
  } catch (error) {
    console.error('Jellyfin auto-connect error:', error)
    return NextResponse.json({ success: false, error: 'Failed to connect to Jellyfin server. Check the URL and try again.' }, { status: 500 })
  }
}
