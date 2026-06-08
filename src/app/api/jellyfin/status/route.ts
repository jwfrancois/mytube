import { NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

export async function GET() {
  try {
    // This will auto-connect from env vars if no credentials are in DB
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ connected: false, server: null })
    }

    // Try to get server info from Jellyfin for additional details
    let serverInfo: { serverName: string; version: string; operatingSystem: string } | null = null
    try {
      const infoRes = await fetch(`${creds.serverUrl}/System/Info`, {
        headers: {
          'X-Emby-Token': creds.accessToken,
        },
        signal: AbortSignal.timeout(5000),
      })
      if (infoRes.ok) {
        const info = await infoRes.json()
        serverInfo = {
          serverName: info.ServerName || 'Jellyfin',
          version: info.Version || '',
          operatingSystem: info.OperatingSystem || '',
        }
      }
    } catch {
      // Non-critical — server info is just nice to have
    }

    // Try to get the DB record for the full ID
    let dbId = 'session'
    try {
      const { db } = await import('@/lib/db')
      const server = await db.jellyfinServer.findFirst()
      if (server) {
        dbId = server.id
      }
    } catch {
      // DB unavailable
    }

    return NextResponse.json({
      connected: true,
      server: {
        id: dbId,
        name: 'My Jellyfin',
        serverUrl: creds.serverUrl,
        username: creds.username,
        connected: true,
        lastConnected: new Date().toISOString(),
        serverId: creds.serverId,
      },
      serverInfo,
    })
  } catch (error) {
    console.error('Jellyfin status error:', error)
    return NextResponse.json({ connected: false, server: null })
  }
}
