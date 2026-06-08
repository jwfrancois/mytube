import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials, invalidateCredentialCache, forceReconnect } from '@/lib/jellyfin-credentials'
import { mediaCache } from '@/lib/media-cache'

/**
 * Fetch Jellyfin items by media category type.
 * Uses DB-backed caching instead of in-memory Maps for Vercel serverless compatibility.
 *
 * Query params:
 *   type - MOVIE | TV_SHOW | MUSIC | PODCAST | AUDIOBOOK | COLLECTION
 *   limit - max items to return (default 100)
 */

const TYPE_TO_COLLECTION_TYPE: Record<string, string[]> = {
  MOVIE: ['movies', 'homevideos'],
  TV_SHOW: ['tvshows'],
  MUSIC: ['music'],
  PODCAST: ['podcasts', 'music'], // Podcasts library may use 'music' collectionType
  AUDIOBOOK: ['books'],
  COLLECTION: ['boxsets'],
}

// Library name patterns to match for each type (case-insensitive)
const TYPE_TO_NAME_PATTERNS: Record<string, RegExp[]> = {
  PODCAST: [/podcast/i, /talk/i, /radio/i, /show/i],
  MUSIC: [], // No name filter
  COLLECTION: [/collection/i],
}

// Name patterns to EXCLUDE for a type
const TYPE_TO_EXCLUDE_NAME_PATTERNS: Record<string, RegExp[]> = {
  MUSIC: [/podcast/i, /talk/i, /radio/i],
}

const TYPE_TO_ITEM_TYPES: Record<string, string> = {
  MOVIE: 'Movie',
  TV_SHOW: 'Series',
  MUSIC: 'MusicAlbum,Audio',
  PODCAST: 'Series,Audio',
  AUDIOBOOK: 'AudioBook,Audio',
  COLLECTION: 'BoxSet',
}

export async function GET(request: NextRequest) {
  try {
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!type) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    // Check DB-backed cache first
    const cacheKey = `category-${type}-${limit}`
    const cached = await mediaCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const collectionTypes = TYPE_TO_COLLECTION_TYPE[type]
    const includeItemTypes = TYPE_TO_ITEM_TYPES[type]

    if (!collectionTypes) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    // Step 1: Get top-level libraries/views to find matching ones
    const viewsController = new AbortController()
    const viewsTimeout = setTimeout(() => viewsController.abort(), 10000)

    const viewsRes = await fetch(`${creds.serverUrl}/Users/${creds.userId}/Views`, {
      headers: { 'X-Emby-Token': creds.accessToken },
      signal: viewsController.signal,
    })
    clearTimeout(viewsTimeout)

    if (!viewsRes.ok) {
      // If 401, the token is invalid — try force reconnecting once
      if (viewsRes.status === 401) {
        invalidateCredentialCache()
        const newCreds = await forceReconnect()
        if (newCreds) {
          // Retry with new credentials
          const retryRes = await fetch(`${newCreds.serverUrl}/Users/${newCreds.userId}/Views`, {
            headers: { 'X-Emby-Token': newCreds.accessToken },
            signal: AbortSignal.timeout(10000),
          })
          if (retryRes.ok) {
            const retryData = await retryRes.json()
            return await processLibraries(retryData, newCreds, type, limit, cacheKey)
          }
        }
      }
      return NextResponse.json({ items: [], totalRecordCount: 0, error: viewsRes.status === 401 ? 'Jellyfin authentication expired. Please reconnect.' : 'Failed to fetch libraries from Jellyfin.' })
    }

    const viewsData = await viewsRes.json()
    return await processLibraries(viewsData, creds, type, limit, cacheKey)
  } catch (error) {
    console.error('Jellyfin category error:', error)
    return NextResponse.json({ items: [], totalRecordCount: 0 })
  }
}

function mapJellyfinItem(item: any, requestType: string, collectionType: string, libraryName: string = '') {
  let type = requestType
  const isPodcastLibrary = collectionType === 'podcasts' || /podcast/i.test(libraryName)
  if (isPodcastLibrary) {
    if (item.Type === 'Series') type = 'PODCAST'
    else if (item.Type === 'Audio') type = 'PODCAST'
    else if (item.Type === 'MusicAlbum') type = 'PODCAST'
  } else if (collectionType === 'books') {
    if (item.Type === 'AudioBook') type = 'AUDIOBOOK'
    else if (item.Type === 'Audio') type = 'AUDIOBOOK'
  } else if (item.Type === 'BoxSet') {
    type = 'COLLECTION'
  }

  let duration = ''
  if (item.RunTimeTicks) {
    const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
  }

  const hasChildren =
    item.Type === 'Series' ||
    item.Type === 'Season' ||
    item.Type === 'MusicAlbum' ||
    item.Type === 'MusicArtist' ||
    item.Type === 'BoxSet' ||
    item.IsFolder ||
    (item.ChildCount && item.ChildCount > 0)

  return {
    id: `jf-${item.Id}`,
    title: item.Name || 'Untitled',
    description: item.Overview || '',
    type,
    genre: (item.Genres || []).join(', '),
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : '',
    videoUrl: '',
    duration,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || item.Artists?.join(', ') || '',
    views: 0,
    channel: item.OfficialRating || item.Studios?.[0]?.Name || '',
    isJellyfin: true,
    jellyfinId: item.Id,
    mediaSourceId: item.MediaSources?.[0]?.Id || '',
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren,
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    collectionType,
  }
}
