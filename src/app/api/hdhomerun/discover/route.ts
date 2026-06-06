import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/hdhomerun/discover
 * List all saved HDHomerun tuners
 */
export async function GET() {
  try {
    const tuners = await db.hDHomerunTuner.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ tuners })
  } catch (error) {
    console.error('HDHomerun discover error:', error)
    return NextResponse.json({ error: 'Failed to list tuners' }, { status: 500 })
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
    } catch (err) {
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
