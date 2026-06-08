import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { mediaCache } from '@/lib/media-cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const genre = searchParams.get('genre')
    const sort = searchParams.get('sort') || 'recent'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeJellyfin = searchParams.get('includeJellyfin') === 'true'

    // Check DB-backed cache
    const cacheKey = `media-${type || 'all'}-${genre || 'all'}-${sort}-${limit}-${offset}-${includeJellyfin}`
    const cached = await mediaCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

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
        const { getJellyfinCredentials } = await import('@/lib/jellyfin-credentials')
        const creds = await getJellyfinCredentials()
        if (creds && creds.connected) {
          const types = type ? [type] : ['MOVIE', 'TV_SHOW', 'MUSIC', 'PODCAST', 'AUDIOBOOK', 'COLLECTION']

          for (let i = 0; i < types.length; i += 2) {
            const batch = types.slice(i, i + 2)
            const results = await Promise.allSettled(
              batch.map(async (t) => {
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
          }
          jellyfinTotal = jellyfinItems.length
        }
      } catch (err) {
        console.error('Failed to fetch Jellyfin items for category:', err)
      }
    }

    // Merge: Jellyfin items first, then local items
    const seenIds = new Set<string>()
    const allMedia = [...jellyfinItems, ...media].filter((item) => {
      if (seenIds.has(item.id)) return false
      seenIds.add(item.id)
      return true
    })

    const result = {
      media: allMedia,
      total: total + jellyfinTotal,
      localCount: total,
      jellyfinCount: jellyfinTotal,
    }

    // Cache in DB for 2 minutes
    await mediaCache.set(cacheKey, result, 120)

    return NextResponse.json(result)
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

    // Invalidate media cache on new media creation
    await mediaCache.deleteByPrefix('media-')

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Error creating media:', error)
    return NextResponse.json({ error: 'Failed to create media' }, { status: 500 })
  }
}
