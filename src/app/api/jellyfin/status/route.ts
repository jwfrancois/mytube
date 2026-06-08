import { NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

export async function GET() {
  try {
    // This will auto-connect from env vars if no credentials are in DB
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ connected: false, server: null })
    }

    // Also check DB for the server record to get the full info
    const { db } = await import('@/lib/db')
    const server = await db.jellyfinServer.findFirst()

    return NextResponse.json({
      connected: true,
      server: {
        id: server?.id || 'auto',
        name: server?.name || 'My Jellyfin',
        serverUrl: creds.serverUrl,
        username: creds.username,
        connected: true,
        lastConnected: server?.lastConnected || new Date().toISOString(),
        serverId: creds.serverId,
      },
    })
  } catch (error) {
    console.error('Jellyfin status error:', error)
    return NextResponse.json({ connected: false, server: null })
  }
}
