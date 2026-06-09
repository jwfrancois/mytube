import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/hdhomerun/status
 * Get the tuner status from a connected HDHomerun device.
 */
export async function GET(request: NextRequest) {
  try {
    const tuner = await db.hDHomerunTuner.findFirst({ where: { connected: true } })

    if (!tuner) {
      return NextResponse.json(
        { error: 'No connected HDHomerun tuner found' },
        { status: 404 }
      )
    }

    // Fetch the tuner status
    let tunerStatus: any = null
    try {
      const statusUrl = `http://${tuner.tunerIp}/status.json`
      const res = await fetch(statusUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'MyTube/1.0' },
      })

      if (res.ok) {
        tunerStatus = await res.json()
      }
    } catch {
      // Status not available — device may be offline
    }

    // Also check the transcoding service status
    let transcoderStatus: any = null
    try {
      const res = await fetch('http://localhost:3010/status', {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        transcoderStatus = await res.json()
      }
    } catch {
      // Transcoding service not running
    }

    return NextResponse.json({
      tuner: {
        id: tuner.id,
        name: tuner.name,
        tunerIp: tuner.tunerIp,
        model: tuner.model,
        firmware: tuner.firmware,
        deviceId: tuner.deviceId,
        tunerCount: tuner.tunerCount,
        connected: tuner.connected,
        lastConnected: tuner.lastConnected,
      },
      tunerStatus,
      transcoderStatus,
    })
  } catch (error) {
    console.error('HDHomerun status error:', error)
    return NextResponse.json({ error: 'Failed to get tuner status' }, { status: 500 })
  }
}
