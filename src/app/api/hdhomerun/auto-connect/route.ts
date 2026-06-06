import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/hdhomerun/auto-connect
 * Auto-connect to a known HDHomerun tuner.
 * If the tuner is already connected in the DB, just verify it's still reachable.
 * If the DB has a previously-connected tuner, try reconnecting.
 * If a specific IP is provided (e.g., from env), try connecting to it.
 */
export async function POST() {
  try {
    // Step 1: Check if there's already a connected tuner
    const existing = await db.hDHomerunTuner.findFirst({ where: { connected: true } })
    if (existing) {
      // Verify it's still reachable
      try {
        const res = await fetch(`http://${existing.tunerIp}/discover.json`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })
        if (res.ok) {
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
      } catch {
        // Device unreachable — mark as disconnected
        await db.hDHomerunTuner.update({
          where: { id: existing.id },
          data: { connected: false },
        })
      }
    }

    // Step 2: Try to connect to any previously-known tuner
    const knownTuners = await db.hDHomerunTuner.findMany({
      orderBy: { lastConnected: 'desc' },
    })

    for (const tuner of knownTuners) {
      try {
        const res = await fetch(`http://${tuner.tunerIp}/discover.json`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })

        if (res.ok) {
          const deviceInfo = await res.json()

          // Update the tuner as connected
          const updated = await db.hDHomerunTuner.update({
            where: { id: tuner.id },
            data: {
              connected: true,
              lastConnected: new Date(),
              name: deviceInfo.ModelName || deviceInfo.Model || tuner.name,
              model: deviceInfo.Model || tuner.model,
              firmware: deviceInfo.FirmwareName || deviceInfo.FirmwareVersion || tuner.firmware,
              deviceId: String(deviceInfo.DeviceId || tuner.deviceId),
              tunerCount: deviceInfo.TunerCount || tuner.tunerCount,
            },
          })

          return NextResponse.json({
            success: true,
            tuner: {
              id: updated.id,
              name: updated.name,
              tunerIp: updated.tunerIp,
              model: updated.model,
              firmware: updated.firmware,
              deviceId: updated.deviceId,
              tunerCount: updated.tunerCount,
              connected: true,
            },
          })
        }
      } catch {
        // This tuner is unreachable, try the next one
      }
    }

    // Step 3: Try the default IP from environment variable
    const defaultIp = process.env.HDHOMERUN_IP
    if (defaultIp) {
      try {
        const res = await fetch(`http://${defaultIp}/discover.json`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })

        if (res.ok) {
          const deviceInfo = await res.json()

          const tuner = await db.hDHomerunTuner.upsert({
            where: { tunerIp: defaultIp },
            create: {
              tunerIp: defaultIp,
              name: deviceInfo.ModelName || deviceInfo.Model || 'HDHomeRun',
              model: deviceInfo.Model || '',
              firmware: deviceInfo.FirmwareName || deviceInfo.FirmwareVersion || '',
              deviceId: String(deviceInfo.DeviceId || ''),
              tunerCount: deviceInfo.TunerCount || 2,
              connected: true,
              lastConnected: new Date(),
            },
            update: {
              name: deviceInfo.ModelName || deviceInfo.Model || 'HDHomeRun',
              model: deviceInfo.Model || '',
              firmware: deviceInfo.FirmwareName || deviceInfo.FirmwareVersion || '',
              deviceId: String(deviceInfo.DeviceId || ''),
              tunerCount: deviceInfo.TunerCount || 2,
              connected: true,
              lastConnected: new Date(),
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
              connected: true,
            },
          })
        }
      } catch {
        // Default IP unreachable
      }
    }

    // Step 4: No reachable tuner found
    return NextResponse.json({
      success: false,
      message: 'No HDHomerun tuner found on the network. Please add one in Settings.',
    })
  } catch (error) {
    console.error('HDHomerun auto-connect error:', error)
    return NextResponse.json({ error: 'Auto-connect failed' }, { status: 500 })
  }
}
