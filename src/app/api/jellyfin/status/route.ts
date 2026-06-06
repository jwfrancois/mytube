import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const servers = await db.jellyfinServer.findMany()

    if (servers.length === 0) {
      return NextResponse.json({ connected: false, server: null })
    }

    const server = servers[0]

    // Return connection info from DB without making external requests
    // External verification can cause process stability issues
    // Known server ID constant (not stored in DB to avoid schema migration)
    const JELLYFIN_SERVER_ID = '363ac50118644e63bddcd34c6dc063a9'

    return NextResponse.json({
      connected: server.connected,
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
    console.error('Jellyfin status error:', error)
    return NextResponse.json({ connected: false, server: null })
  }
}
