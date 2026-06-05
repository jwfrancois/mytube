import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type')

    if (!q.trim()) {
      return NextResponse.json({ media: [] })
    }

    const where: Record<string, unknown> = {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { artist: { contains: q } },
        { genre: { contains: q } },
        { channel: { contains: q } },
      ],
    }

    if (type) {
      where.type = type
    }

    const media = await db.media.findMany({
      where,
      orderBy: { views: 'desc' },
      take: 20,
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error('Error searching media:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
