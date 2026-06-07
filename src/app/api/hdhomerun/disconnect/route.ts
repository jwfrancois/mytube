import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * DELETE /api/hdhomerun/disconnect
 * Disconnect an HDHomerun tuner by ID, or disconnect all tuners.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tunerId = searchParams.get('id')

    if (tunerId) {
      // Disconnect a specific tuner
      const tuner = await db.hDHomerunTuner.findUnique({ where: { id: tunerId } })
      if (!tuner) {
        return NextResponse.json({ error: 'Tuner not found' }, { status: 404 })
      }

      await db.hDHomerunTuner.update({
        where: { id: tunerId },
        data: { connected: false },
      })

      // Stop any active transcoder streams for this tuner
      try {
        await fetch('http://localhost:3010/stop-all', { method: 'POST' })
      } catch {
        // Transcoder not running, that's fine
      }

      return NextResponse.json({ success: true, message: `Disconnected tuner ${tuner.name}` })
    }

    // Disconnect all tuners
    const result = await db.hDHomerunTuner.updateMany({
      where: { connected: true },
      data: { connected: false },
    })

    // Stop all transcoder streams
    try {
      await fetch('http://localhost:3010/stop-all', { method: 'POST' })
    } catch {
      // Transcoder not running
    }

    return NextResponse.json({
      success: true,
      message: `Disconnected ${result.count} tuner(s)`,
    })
  } catch (error) {
    console.error('HDHomerun disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect tuner' }, { status: 500 })
  }
}
