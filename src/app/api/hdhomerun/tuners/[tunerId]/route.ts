import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * DELETE /api/hdhomerun/tuners/[tunerId]
 * Deletes a specific HDHomerun tuner from the database.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tunerId: string }> }
) {
  try {
    const { tunerId } = await params

    // Check if the tuner exists
    const tuner = await db.hDHomerunTuner.findUnique({
      where: { id: tunerId },
    })

    if (!tuner) {
      return NextResponse.json(
        { error: 'Tuner not found' },
        { status: 404 }
      )
    }

    // Delete the tuner
    await db.hDHomerunTuner.delete({
      where: { id: tunerId },
    })

    return NextResponse.json({
      success: true,
      message: `Deleted tuner "${tuner.name}" (${tuner.tunerIp})`,
      deletedTuner: {
        id: tuner.id,
        name: tuner.name,
        tunerIp: tuner.tunerIp,
        model: tuner.model,
        deviceId: tuner.deviceId,
      },
    })
  } catch (error) {
    console.error('HDHomerun tuner delete error:', error)
    return NextResponse.json({ error: 'Failed to delete tuner' }, { status: 500 })
  }
}
