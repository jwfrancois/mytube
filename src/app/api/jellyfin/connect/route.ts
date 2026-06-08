import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { mediaCache } from '@/lib/media-cache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serverUrl, username, password } = body

    if (!serverUrl || !username || !password) {
      return NextResponse.json({ error: 'Server URL, username, and password are required' }, { status: 400 })
    }

    const baseUrl = serverUrl.replace(/\/+$/, '')

    // Authenticate with Jellyfin with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let authResponse: Response
    try {
      authResponse = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': `Emby Client="MyTube", Device="WebBrowser", DeviceId="mytube-${Date.now()}", Version="1.0.0"`,
        },
        body: JSON.stringify({ Username: username, Pw: password }),
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Jellyfin connect fetch error:', fetchError)
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json({ error: 'Connection timed out. The Jellyfin server may be offline or unreachable.' }, { status: 504 })
      }
      return NextResponse.json({ error: `Cannot reach Jellyfin server at ${baseUrl}. Check the URL and try again.` }, { status: 502 })
    }

    clearTimeout(timeoutId)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Jellyfin auth failed:', authResponse.status, errorText)
      if (authResponse.status === 401) {
        return NextResponse.json({ error: 'Authentication failed. Check your username and password.' }, { status: 401 })
      }
      if (authResponse.status === 404) {
        return NextResponse.json({ error: 'Jellyfin server not found at this URL. Make sure the URL is correct.' }, { status: 404 })
      }
      if (authResponse.status === 500) {
        return NextResponse.json({ error: 'Jellyfin server is experiencing an internal error. Please restart your Jellyfin server and try again.' }, { status: 502 })
      }
      return NextResponse.json({ error: `Jellyfin server returned error (${authResponse.status}). Check the server URL.` }, { status: authResponse.status })
    }

    const authData = await authResponse.json()
    const { AccessToken, User, ServerId } = authData

    if (!AccessToken || !User?.Id) {
      return NextResponse.json({ error: 'Invalid response from Jellyfin server. The server may not be running correctly.' }, { status: 500 })
    }

    // Authentication succeeded! Now try to save to database (non-fatal if it fails)
    let serverId: string = ServerId || '363ac50118644e63bddcd34c6dc063a9'
    let dbServerId: string | undefined

    try {
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
      dbServerId = server.id

      // Invalidate all cached media data since we have a new connection
      await mediaCache.clear().catch(() => {})
    } catch (dbError) {
      console.error('Jellyfin connect: DB save failed (non-fatal):', dbError)
      // Continue anyway — the auth succeeded, we just can't persist it
    }

    return NextResponse.json({
      success: true,
      server: {
        id: dbServerId || 'session',
        name: 'My Jellyfin',
        serverUrl: baseUrl,
        username: User.Name || username,
        connected: true,
        lastConnected: new Date().toISOString(),
        serverId,
      },
    })
  } catch (error) {
    console.error('Jellyfin connect error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred while connecting to Jellyfin.' }, { status: 500 })
  }
}
