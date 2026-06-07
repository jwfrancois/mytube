import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/hdhomerun/discover
 * Auto-discovers HDHomerun devices on the network.
 * First checks if there's a tuner IP in env vars (HDHOMERUN_IP).
 * Fetches http://{ip}/discover.json which returns device info.
 * Returns device details.
 */
export async function GET() {
  try {
    // Step 1: Check for HDHOMERUN_IP environment variable
    const envIp = process.env.HDHOMERUN_IP

    if (envIp) {
      // Try to discover the device at the configured IP
      try {
        const discoverUrl = `http://${envIp}/discover.json`
        const res = await fetch(discoverUrl, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })

        if (res.ok) {
          const deviceInfo = await res.json()

          return NextResponse.json({
            discovered: true,
            source: 'env',
            tunerIp: envIp,
            deviceInfo: {
              DeviceID: deviceInfo.DeviceID || deviceInfo.DeviceId || '',
              ModelNumber: deviceInfo.ModelNumber || deviceInfo.Model || '',
              FirmwareName: deviceInfo.FirmwareName || '',
              FirmwareVersion: deviceInfo.FirmwareVersion || '',
              TunerCount: deviceInfo.TunerCount || 2,
              ModelName: deviceInfo.ModelName || '',
              FriendlyName: deviceInfo.FriendlyName || '',
              Manufacturer: deviceInfo.Manufacturer || '',
              LineupURL: deviceInfo.LineupURL || '',
            },
          })
        }
      } catch {
        // Device at env IP is unreachable
        return NextResponse.json({
          discovered: false,
          source: 'env',
          tunerIp: envIp,
          error: `Device at ${envIp} is not reachable`,
        })
      }
    }

    // Step 2: If no env var or env device unreachable, check for previously registered tuners
    const knownTuners = await db.hDHomerunTuner.findMany({
      orderBy: { lastConnected: 'desc' },
    })

    // Try each known tuner to find one that's reachable
    for (const tuner of knownTuners) {
      try {
        const discoverUrl = `http://${tuner.tunerIp}/discover.json`
        const res = await fetch(discoverUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'MyTube/1.0' },
        })

        if (res.ok) {
          const deviceInfo = await res.json()

          return NextResponse.json({
            discovered: true,
            source: 'database',
            tunerIp: tuner.tunerIp,
            tunerId: tuner.id,
            deviceInfo: {
              DeviceID: deviceInfo.DeviceID || deviceInfo.DeviceId || '',
              ModelNumber: deviceInfo.ModelNumber || deviceInfo.Model || '',
              FirmwareName: deviceInfo.FirmwareName || '',
              FirmwareVersion: deviceInfo.FirmwareVersion || '',
              TunerCount: deviceInfo.TunerCount || 2,
              ModelName: deviceInfo.ModelName || '',
              FriendlyName: deviceInfo.FriendlyName || '',
              Manufacturer: deviceInfo.Manufacturer || '',
              LineupURL: deviceInfo.LineupURL || '',
            },
          })
        }
      } catch {
        // This tuner is unreachable, try next
      }
    }

    // No device found
    return NextResponse.json({
      discovered: false,
      source: envIp ? 'env' : 'none',
      ...(envIp ? { tunerIp: envIp } : {}),
      message: 'No HDHomerun device found. Set HDHOMERUN_IP environment variable or register a tuner manually.',
    })
  } catch (error) {
    console.error('HDHomerun discover error:', error)
    return NextResponse.json({ error: 'Failed to discover HDHomerun device' }, { status: 500 })
  }
}

/**
 * POST /api/hdhomerun/discover
 * Connect to an HDHomerun tuner by IP address.
 * Validates the device by fetching /discover.json from the tuner.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tunerIp } = body

    if (!tunerIp) {
      return NextResponse.json({ error: 'tunerIp is required' }, { status: 400 })
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(tunerIp)) {
      return NextResponse.json({ error: 'Invalid IP address format' }, { status: 400 })
    }

    // Try to discover the device by fetching /discover.json
    let deviceInfo: Record<string, any> = {}
    try {
      const discoverUrl = `http://${tunerIp}/discover.json`
      const res = await fetch(discoverUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'MyTube/1.0' },
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `HDHomerun device at ${tunerIp} returned status ${res.status}` },
          { status: 502 }
        )
      }

      deviceInfo = await res.json()
    } catch {
      return NextResponse.json(
        { error: `Could not reach HDHomerun device at ${tunerIp}. Make sure the IP is correct and the device is on the same network.` },
        { status: 502 }
      )
    }

    // Verify this is actually an HDHomerun device
    if (!deviceInfo.DeviceId && !deviceInfo.Model) {
      return NextResponse.json(
        { error: `Device at ${tunerIp} does not appear to be an HDHomerun tuner` },
        { status: 400 }
      )
    }

    // Save or update the tuner in the database
    const tuner = await db.hDHomerunTuner.upsert({
      where: { tunerIp },
      create: {
        tunerIp,
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
        connected: tuner.connected,
      },
      deviceInfo,
    })
  } catch (error) {
    console.error('HDHomerun discover error:', error)
    return NextResponse.json({ error: 'Failed to discover HDHomerun device' }, { status: 500 })
  }
}
