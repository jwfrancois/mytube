import { db } from '@/lib/db'
import { getCachedJellyfinItems, getAllCachedJellyfinItems } from '@/lib/jellyfin-cache'
import { ClientCredentials, setCredentialsFromClient } from '@/lib/jellyfin-credentials'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const genre = searchParams.get('genre')
    const sort = searchParams.get('sort') || 'recent'

    // Client may pass Jellyfin credentials in query params for Vercel serverless.
    // On a cold start the in-memory cache is empty; the credentials let us
    // fetch from Jellyfin directly instead of returning an empty list.
    const serverUrl = searchParams.get('serverUrl')
    const userId = searchParams.get('userId')
    const accessToken = searchParams.get('accessToken')
    let credentials: ClientCredentials | undefined
    if (serverUrl && userId && accessToken) {
      credentials = { serverUrl, userId, accessToken }
      // Seed credentials into in-memory cache so downstream functions can use them
      setCredentialsFromClient(credentials)
    }

    // Fetch local media (gracefully handle DB errors)
    // For PODCAST and COLLECTION, skip local DB query (local Media model
    // doesn't have those types – only return cached Jellyfin items).
    const skipLocalQuery = type === 'PODCAST' || type === 'COLLECTION'
    const where: Record<string, any> = {}
    if (type && type !== 'ALL' && type !== 'JELLYFIN') {
      where.type = type
    }
    if (genre) where.genre = { contains: genre }

    let localMedia: any[] = []
    if (!skipLocalQuery) {
      try {
        localMedia = await db.media.findMany({
          where,
          orderBy: sort === 'popular' ? { views: 'desc' } : sort === 'rating' ? { createdAt: 'desc' } : { createdAt: 'desc' },
          take: 100,
        })
      } catch (dbError) {
        console.error('Local media DB error (non-fatal):', dbError)
        // Continue without local media
      }
    }

    // Get Jellyfin items from cache.
    // If credentials are provided and the cache is empty, getCachedJellyfinItems
    // will AWAIT a live fetch from Jellyfin instead of returning [] immediately.
    let jellyfinItems: any[] = []
    const jellyfinType = type?.toUpperCase()

    if (jellyfinType && !['ALL', 'JELLYFIN'].includes(jellyfinType)) {
      // Specific category: fetch that category's cached items
      const cached = await getCachedJellyfinItems(jellyfinType, credentials)
      jellyfinItems = cached.items
    } else if (!type || jellyfinType === 'ALL') {
      // Home page: get all cached Jellyfin items (deduplicated)
      // On a cold start with credentials, the individual category caches are empty,
      // so prewarm them first (awaited) before reading the aggregate.
      const allItems = getAllCachedJellyfinItems()
      if (allItems.length > 0) {
        jellyfinItems = allItems
      } else if (credentials) {
        // No cached items and we have credentials – prewarm all caches (awaited)
        const categories = ['MOVIE', 'TV_SHOW', 'MUSIC', 'AUDIOBOOK', 'BOOK', 'COLLECTION', 'PODCAST'] as const
        await Promise.all(categories.map(c => getCachedJellyfinItems(c, credentials)))
        jellyfinItems = getAllCachedJellyfinItems()
      }
    }

    // Merge and deduplicate by ID — Jellyfin items FIRST for NAS priority
    const localItems = localMedia.map((item) => ({ ...item, isJellyfin: false }))
    const seen = new Set<string>()
    const merged: any[] = []

    for (const item of jellyfinItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    for (const item of localItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }

    return NextResponse.json({ media: merged, total: merged.length })
  } catch (error) {
    console.error('Error fetching merged media:', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}
