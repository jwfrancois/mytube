import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch all watch later items
export async function GET() {
  try {
    const items = await db.watchLaterItem.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      items: items.map(item => ({
        id: `jf-${item.jellyfinId}`,
        title: item.title,
        description: item.overview,
        type: item.type,
        genre: item.genre,
        thumbnail: item.thumbnail,
        videoUrl: '',
        duration: item.duration,
        releaseYear: item.releaseYear,
        artist: '',
        views: 0,
        channel: '',
        isJellyfin: true,
        jellyfinId: item.jellyfinId,
        itemType: item.type === 'TV_SHOW' ? 'Series' : item.type === 'MUSIC' ? 'MusicAlbum' : 'Movie',
        hasChildren: item.type === 'TV_SHOW' || item.type === 'COLLECTION' || item.type === 'MUSIC',
        childCount: 0,
        communityRating: item.communityRating,
        mediaType: item.type === 'MUSIC' || item.type === 'PODCAST' || item.type === 'AUDIOBOOK' ? 'audio' : 'video',
        libraryName: '',
      })),
    })
  } catch (error) {
    console.error('Watchlist GET error:', error)
    return NextResponse.json({ items: [] })
  }
}

// POST - Add item to watch later
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jellyfinId, title, type, thumbnail, overview, genre, releaseYear, duration, communityRating } = body

    if (!jellyfinId || !title) {
      return NextResponse.json({ error: 'jellyfinId and title are required' }, { status: 400 })
    }

    const item = await db.watchLaterItem.upsert({
      where: { jellyfinId },
      update: {
        title,
        type: type || 'MOVIE',
        thumbnail: thumbnail || '',
        overview: overview || '',
        genre: genre || '',
        releaseYear: releaseYear || 0,
        duration: duration || '',
        communityRating: communityRating || 0,
      },
      create: {
        jellyfinId,
        title,
        type: type || 'MOVIE',
        thumbnail: thumbnail || '',
        overview: overview || '',
        genre: genre || '',
        releaseYear: releaseYear || 0,
        duration: duration || '',
        communityRating: communityRating || 0,
      },
    })

    // Log activity
    try {
      await db.userActivity.upsert({
        where: { jellyfinId_action: { jellyfinId, action: 'watch_later' } },
        update: { title, type: type || 'MOVIE', thumbnail: thumbnail || '' },
        create: { jellyfinId, title, type: type || 'MOVIE', thumbnail: thumbnail || '', action: 'watch_later' },
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Watchlist POST error:', error)
    return NextResponse.json({ error: 'Failed to add to watch later' }, { status: 500 })
  }
}

// DELETE - Remove item from watch later
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jellyfinId = searchParams.get('jellyfinId')

    if (!jellyfinId) {
      return NextResponse.json({ error: 'jellyfinId is required' }, { status: 400 })
    }

    await db.watchLaterItem.delete({
      where: { jellyfinId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Watchlist DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove from watch later' }, { status: 500 })
  }
}
