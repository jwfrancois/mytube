import { NextRequest, NextResponse } from 'next/server'
import { fetchJellyfinCategoryItems, fetchAllJellyfinItems } from '@/lib/jellyfin-category'
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

    // Check DB-backed cache (non-fatal if it fails)
    const cacheKey = `media-${type || 'all'}-${genre || 'all'}-${sort}-${limit}-${offset}-${includeJellyfin}`
    try {
      const cached = await mediaCache.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    } catch (cacheErr) {
      console.error('Media cache get error (non-fatal):', cacheErr)
    }

    // Fetch local media from database (non-fatal if it fails)
    let media: any[] = []
    let total = 0
    try {
      const { db } = await import('@/lib/db')
      const where: Record<string, string> = {}
      if (type) where.type = type
      if (genre) where.genre = genre

      media = await db.media.findMany({
        where,
        orderBy: sort === 'popular' ? { views: 'desc' } : { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      total = await db.media.count({ where })
    } catch (dbErr) {
      console.error('Local media DB query error (non-fatal):', dbErr)
      // DB might not be set up yet — continue with just Jellyfin items
    }

    // Fetch Jellyfin items directly (non-fatal if it fails)
    let jellyfinItems: any[] = []
    let jellyfinTotal = 0

    if (includeJellyfin) {
      try {
        const { getJellyfinCredentials } = await import('@/lib/jellyfin-credentials')
        const creds = await getJellyfinCredentials()
        if (creds && creds.connected) {
          if (type) {
            const categoryResult = await fetchJellyfinCategoryItems(type, 50)
            jellyfinItems = categoryResult.items || []
            jellyfinTotal = categoryResult.totalRecordCount || 0
          } else {
            jellyfinItems = await fetchAllJellyfinItems(20)
            jellyfinTotal = jellyfinItems.length
          }
        }
      } catch (jellyfinErr) {
        console.error('Jellyfin fetch error (non-fatal):', jellyfinErr)
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

    // Cache in DB for 2 minutes (non-fatal if it fails)
    try {
      await mediaCache.set(cacheKey, result, 120)
    } catch (cacheErr) {
      console.error('Media cache set error (non-fatal):', cacheErr)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching media (unhandled):', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { db } = await import('@/lib/db')
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
    try {
      await mediaCache.deleteByPrefix('media-')
    } catch {
      // Non-fatal
    }

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Error creating media:', error)
    return NextResponse.json({ error: 'Failed to create media' }, { status: 500 })
  }
}
