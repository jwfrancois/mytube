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
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let authResponse: Response
    try {
      authResponse = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': `Emby Client="MyTube", Device="WebBrowser", DeviceId="mytube-auto", Version="1.0.0"`,
        },
        body: JSON.stringify({ Username: username, Pw: password }),
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Jellyfin auto-connect fetch error:', fetchError)
      return NextResponse.json({
        success: false,
        error: fetchError?.name === 'AbortError'
          ? 'Connection to Jellyfin server timed out.'
          : `Cannot reach Jellyfin server at ${baseUrl}.`,
      }, { status: 502 })
    }

    clearTimeout(timeoutId)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Jellyfin auto-connect auth failed:', authResponse.status, errorText)
      return NextResponse.json({
        success: false,
        error: authResponse.status === 401
          ? 'Auto-connect authentication failed. Check JELLYFIN_USERNAME and JELLYFIN_PASSWORD environment variables.'
          : `Jellyfin server returned error (${authResponse.status}).`,
      }, { status: authResponse.status === 401 ? 401 : 502 })
    }

    const authData = await authResponse.json()
    const { AccessToken, User, ServerId } = authData

    if (!AccessToken || !User?.Id) {
      return NextResponse.json({ success: false, error: 'Invalid response from Jellyfin server' }, { status: 500 })
    }

    // Authentication succeeded! Now try to save to database (non-fatal if it fails)
    const serverId: string = ServerId || '363ac50118644e63bdddc34c6dc063a9'
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

      // Clear cached media data on new connection
      await mediaCache.clear().catch(() => {})
    } catch (dbError) {
      console.error('Jellyfin auto-connect: DB save failed (non-fatal):', dbError)
      // Continue anyway — we have the credentials for this request
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
    console.error('Jellyfin auto-connect error:', error)
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while connecting to Jellyfin.' }, { status: 500 })
  }
}
