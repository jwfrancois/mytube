import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const authResponse = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': `Emby Client="MyTube", Device="WebBrowser", DeviceId="mytube-${Date.now()}", Version="1.0.0"`,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Jellyfin auth failed:', authResponse.status, errorText)
      return NextResponse.json({ error: 'Authentication failed. Check your credentials.' }, { status: 401 })
    }

    const authData = await authResponse.json()
    const { AccessToken, User } = authData

    if (!AccessToken || !User?.Id) {
      return NextResponse.json({ error: 'Invalid response from Jellyfin server' }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        serverUrl: server.serverUrl,
        username: server.username,
        connected: server.connected,
        lastConnected: server.lastConnected,
      },
    })
  } catch (error) {
    console.error('Jellyfin connect error:', error)
    return NextResponse.json({ error: 'Failed to connect to Jellyfin server. Check the URL and try again.' }, { status: 500 })
  }
}
