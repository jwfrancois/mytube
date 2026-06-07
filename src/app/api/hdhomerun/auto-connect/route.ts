import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/hdhomerun/auto-connect
 * 
 * This route checks if a tuner is already registered in the DB.
 * The actual HDHomerun device discovery happens CLIENT-SIDE because
 * the server may be in the cloud and unable to reach local network devices
 * (like an HDHomerun at 10.0.0.187), but the user's browser CAN reach them.
 * 
 * We skip server-side HTTP requests to the tuner to avoid 10+ second timeouts
 * that destabilize the server.
 */
export async function POST() {
  try {
    // Check if there's already a connected tuner in the DB
    const existing = await db.hDHomerunTuner.findFirst({ where: { connected: true } })
    if (existing) {
      return NextResponse.json({
        success: true,
        tuner: {
          id: existing.id,
          name: existing.name,
          tunerIp: existing.tunerIp,
          model: existing.model,
          firmware: existing.firmware,
          deviceId: existing.deviceId,
          tunerCount: existing.tunerCount,
          connected: true,
        },
      })
    }

    // Check if there's any previously-known tuner (but don't try to reach it server-side)
    const knownTuner = await db.hDHomerunTuner.findFirst({
      orderBy: { lastConnected: 'desc' },
    })

    if (knownTuner) {
      // Return the known tuner info — client-side code will verify reachability
      return NextResponse.json({
        success: false,
        message: 'Known tuner found but not verified. Client-side discovery needed.',
        knownTunerIp: knownTuner.tunerIp,
      })
    }

    // Check if there's a default IP from environment
    const defaultIp = process.env.HDHOMERUN_IP
    if (defaultIp) {
      // Don't try to connect server-side — just tell the client to try this IP
      return NextResponse.json({
        success: false,
        message: 'No verified tuner. Client-side discovery recommended.',
        defaultIp,
      })
    }

    return NextResponse.json({
      success: false,
      message: 'No HDHomerun tuner configured. Please add one in Settings.',
    })
  } catch (error) {
    console.error('HDHomerun auto-connect error:', error)
    return NextResponse.json({ error: 'Auto-connect failed' }, { status: 500 })
  }
}
