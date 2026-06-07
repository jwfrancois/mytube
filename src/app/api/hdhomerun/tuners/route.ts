import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/hdhomerun/tuners
 * List all registered HDHomerun tuners from the database.
 * For each tuner, also checks online/offline status by attempting to reach discover.json.
 */
export async function GET() {
  try {
    const tuners = await db.hDHomerunTuner.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Check online/offline status for each tuner concurrently
    const tunersWithStatus = await Promise.all(
      tuners.map(async (tuner) => {
        let online = false
        let deviceInfo: Record<string, any> | null = null

        try {
          const res = await fetch(`http://${tuner.tunerIp}/discover.json`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'MyTube/1.0' },
          })

          if (res.ok) {
            online = true
            deviceInfo = await res.json()
          }
        } catch {
          // Device unreachable
        }

        // Update the connected status in the database if it changed
        if (online !== tuner.connected) {
          await db.hDHomerunTuner.update({
            where: { id: tuner.id },
            data: {
              connected: online,
              ...(online ? { lastConnected: new Date() } : {}),
            },
          })
        }

        return {
          id: tuner.id,
          name: tuner.name,
          tunerIp: tuner.tunerIp,
          model: tuner.model,
          firmware: tuner.firmware,
          deviceId: tuner.deviceId,
          tunerCount: tuner.tunerCount,
          connected: tuner.connected,
          lastConnected: tuner.lastConnected,
          createdAt: tuner.createdAt,
          updatedAt: tuner.updatedAt,
          status: online ? 'online' : 'offline',
          deviceInfo,
        }
      })
    )

    return NextResponse.json({
      tuners: tunersWithStatus,
      total: tunersWithStatus.length,
      onlineCount: tunersWithStatus.filter((t) => t.status === 'online').length,
      offlineCount: tunersWithStatus.filter((t) => t.status === 'offline').length,
    })
  } catch (error) {
    console.error('HDHomerun tuners list error:', error)
    return NextResponse.json({ error: 'Failed to list tuners' }, { status: 500 })
  }
}
