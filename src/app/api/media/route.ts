import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const genre = searchParams.get('genre')
    const sort = searchParams.get('sort') || 'recent'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeJellyfin = searchParams.get('includeJellyfin') === 'true'

    const where: Record<string, string> = {}
    if (type) where.type = type
    if (genre) where.genre = genre

    // Fetch local media from database
    const media = await db.media.findMany({
      where,
      orderBy: sort === 'popular' ? { views: 'desc' } : { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await db.media.count({ where })

    // If requested, also fetch Jellyfin items and merge
    let jellyfinItems: any[] = []
    let jellyfinTotal = 0

    if (includeJellyfin) {
      try {
        if (type) {
          // Fetch items of a specific type from Jellyfin
          const jellyfinRes = await fetch(
            `${request.nextUrl.origin}/api/jellyfin/category?type=${type}&limit=${limit}`,
            { signal: AbortSignal.timeout(15000) }
          )
          if (jellyfinRes.ok) {
            const jellyfinData = await jellyfinRes.json()
            jellyfinItems = jellyfinData.items || []
            jellyfinTotal = jellyfinData.totalRecordCount || 0
          }
        } else {
          // No type filter (ALL/home) — fetch items from all Jellyfin categories
          const types = ['MOVIE', 'TV_SHOW', 'MUSIC', 'PODCAST', 'AUDIOBOOK']
          const results = await Promise.allSettled(
            types.map(async (t) => {
              const jellyfinRes = await fetch(
                `${request.nextUrl.origin}/api/jellyfin/category?type=${t}&limit=20`,
                { signal: AbortSignal.timeout(15000) }
              )
              if (!jellyfinRes.ok) return []
              const jellyfinData = await jellyfinRes.json()
              return jellyfinData.items || []
            })
          )
          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              jellyfinItems.push(...result.value)
            }
          })
          jellyfinTotal = jellyfinItems.length
        }
      } catch (err) {
        console.error('Failed to fetch Jellyfin items for category:', err)
        // Non-fatal: continue with local items only
      }
    }

    // Merge: Jellyfin items first, then local items
    const allMedia = [...jellyfinItems, ...media]

    return NextResponse.json({
      media: allMedia,
      total: total + jellyfinTotal,
      localCount: total,
      jellyfinCount: jellyfinTotal,
    })
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const media = await db.media.create({
      data: {
        title: body.title,
        description: body.description || '',
        type: body.type,
        genre: body.genre || '',
        thumbnail: body.thumbnail || '',
        videoUrl: body.videoUrl || '',
        duration: body.duration || '',
        releaseYear: body.releaseYear || 2024,
        artist: body.artist || '',
        channel: body.channel || '',
        views: 0,
      },
    })
    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Error creating media:', error)
    return NextResponse.json({ error: 'Failed to create media' }, { status: 500 })
  }
}
