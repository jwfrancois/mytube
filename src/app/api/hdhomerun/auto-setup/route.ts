import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/hdhomerun/auto-setup
 * Reads HDHOMERUN_IP from environment variables.
 * If set, automatically registers the tuner by discovering the device
 * and saving it to the database.
 * This is called on app startup to auto-connect the user's tuner.
 */
export async function POST() {
  try {
    const tunerIp = process.env.HDHOMERUN_IP

    if (!tunerIp) {
      return NextResponse.json(
        { error: 'HDHOMERUN_IP environment variable is not set' },
        { status: 400 }
      )
    }

    // Step 1: Discover the device at the configured IP
    let deviceInfo: Record<string, any> = {}
    let deviceReachable = false
    try {
      const discoverUrl = `http://${tunerIp}/discover.json`
      const res = await fetch(discoverUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'MyTube/1.0' },
      })

      if (res.ok) {
        deviceInfo = await res.json()
        deviceReachable = true
      }
    } catch {
      // Device not reachable — might be on a different network or powered off.
      // Still register it in the database so it auto-connects when available.
    }

    // Step 2: Fetch lineup.json to verify channels are available
    let channelCount = 0
    if (deviceReachable) {
      try {
        const lineupUrl = `http://${tunerIp}/lineup.json`
        const res = await fetch(lineupUrl, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })

        if (res.ok) {
          const lineup = await res.json()
          channelCount = Array.isArray(lineup) ? lineup.length : 0
        }
      } catch {
        // Lineup not available — non-fatal
      }
    }

    // Step 3: Upsert the tuner in the database
    // Even if the device isn't reachable, register it so it auto-connects when available
    const existingTuner = await db.hDHomerunTuner.findFirst({ where: { tunerIp } })

    const tuner = await db.hDHomerunTuner.upsert({
      where: { id: existingTuner?.id || `hdhr-${tunerIp.replace(/\./g, '-')}` },
      create: {
        id: existingTuner?.id || `hdhr-${tunerIp.replace(/\./g, '-')}`,
        tunerIp,
        name: deviceInfo.ModelName || deviceInfo.Model || 'HDHomeRun',
        model: deviceInfo.Model || '',
        firmware: deviceInfo.FirmwareName || deviceInfo.FirmwareVersion || '',
        deviceId: String(deviceInfo.DeviceId || ''),
        tunerCount: deviceInfo.TunerCount || 2,
        connected: deviceReachable,
        lastConnected: deviceReachable ? new Date() : null,
      },
      update: {
        name: deviceReachable ? (deviceInfo.ModelName || deviceInfo.Model || 'HDHomeRun') : undefined,
        model: deviceReachable ? (deviceInfo.Model || '') : undefined,
        firmware: deviceReachable ? (deviceInfo.FirmwareName || deviceInfo.FirmwareVersion || '') : undefined,
        deviceId: deviceReachable ? String(deviceInfo.DeviceId || '') : undefined,
        tunerCount: deviceReachable ? (deviceInfo.TunerCount || 2) : undefined,
        connected: deviceReachable,
        lastConnected: deviceReachable ? new Date() : undefined,
      },
    })

    return NextResponse.json({
      success: true,
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
      deviceInfo,
      channelCount,
      deviceReachable,
    })
  } catch (error) {
    console.error('HDHomerun auto-setup error:', error)
    return NextResponse.json({ error: 'Auto-setup failed' }, { status: 500 })
  }
}
