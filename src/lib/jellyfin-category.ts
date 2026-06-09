/**
 * Shared Jellyfin Category Fetching Logic
 *
 * This module contains the core logic for fetching media items from Jellyfin,
 * extracted from the /api/jellyfin/category route so it can be called directly
 * by other API routes (like /api/media) WITHOUT making an internal HTTP self-fetch.
 *
 * On Vercel serverless, internal self-fetches (one API route calling another via HTTP)
 * are unreliable because each route is a separate serverless function, causing:
 * - Cold start chains (double latency)
 * - Timeout failures (the calling function waits for the called function to cold-start)
 * - Silent failures (Promise.allSettled swallows errors)
 *
 * By extracting this logic, /api/media can call the Jellyfin API directly.
 */

import { getJellyfinCredentials, invalidateCredentialCache, forceReconnect } from '@/lib/jellyfin-credentials'
import { mediaCache } from '@/lib/media-cache'

// ──────────────────────────────────────────────
// Type mapping configuration
// ──────────────────────────────────────────────

const TYPE_TO_COLLECTION_TYPE: Record<string, string[]> = {
  MOVIE: ['movies', 'homevideos'],
  TV_SHOW: ['tvshows'],
  MUSIC: ['music'],
  PODCAST: ['podcasts', 'music'],
  AUDIOBOOK: ['books'],
  COLLECTION: ['boxsets'],
}

const TYPE_TO_NAME_PATTERNS: Record<string, RegExp[]> = {
  PODCAST: [/podcast/i, /talk/i, /radio/i, /show/i],
  MUSIC: [],
  COLLECTION: [/collection/i],
}

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

const COMMON_FIELDS = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount'

// ──────────────────────────────────────────────
// Public interface
// ──────────────────────────────────────────────

export interface JellyfinCategoryResult {
  items: any[]
  totalRecordCount: number
  error?: string
}

/**
 * Fetch Jellyfin items for a given media type.
 * This is the primary function that both /api/media and /api/jellyfin/category should use.
 *
 * @param type - The media type category (MOVIE, TV_SHOW, MUSIC, etc.)
 * @param limit - Maximum number of items to return
 * @returns Category result with items array
 */
export async function fetchJellyfinCategoryItems(
  type: string,
  limit: number = 100
): Promise<JellyfinCategoryResult> {
  try {
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return { items: [], totalRecordCount: 0, error: 'Not connected to Jellyfin' }
    }

    if (!type) {
      return { items: [], totalRecordCount: 0 }
    }

    // Check DB-backed cache first (non-fatal if cache is unavailable)
    const cacheKey = `category-${type}-${limit}`
    try {
      const cached = await mediaCache.get(cacheKey)
      if (cached) {
        return cached as JellyfinCategoryResult
      }
    } catch (cacheErr) {
      console.error('Category cache get error (non-fatal):', cacheErr)
    }

    const collectionTypes = TYPE_TO_COLLECTION_TYPE[type]
    if (!collectionTypes) {
      return { items: [], totalRecordCount: 0 }
    }

    // Step 1: Get top-level libraries/views
    let viewsRes = await fetch(`${creds.serverUrl}/Users/${creds.userId}/Views`, {
      headers: { 'X-Emby-Token': creds.accessToken },
      signal: AbortSignal.timeout(10000),
    })

    // If 401, try force reconnecting once
    if (!viewsRes.ok && viewsRes.status === 401) {
      invalidateCredentialCache()
      const newCreds = await forceReconnect()
      if (newCreds) {
        viewsRes = await fetch(`${newCreds.serverUrl}/Users/${newCreds.userId}/Views`, {
          headers: { 'X-Emby-Token': newCreds.accessToken },
          signal: AbortSignal.timeout(10000),
        })
      }
    }

    if (!viewsRes.ok) {
      return { items: [], totalRecordCount: 0, error: 'Failed to fetch libraries from Jellyfin.' }
    }

    const viewsData = await viewsRes.json()
    const libraries = (viewsData.Items || []) as any[]

    // Find libraries matching our type
    const namePatterns = TYPE_TO_NAME_PATTERNS[type] || []
    const excludePatterns = TYPE_TO_EXCLUDE_NAME_PATTERNS[type] || []
    const matchingLibraries = libraries.filter((lib: any) => {
      const libCollectionType = lib.CollectionType || ''
      const libName = lib.Name || ''

      if (excludePatterns.length > 0 && excludePatterns.some(pattern => pattern.test(libName))) {
        return false
      }

      if (collectionTypes.includes(libCollectionType)) {
        if (namePatterns.length > 0) {
          return namePatterns.some(pattern => pattern.test(libName))
        }
        return true
      }

      if (type === 'PODCAST' && /podcast/i.test(libName)) {
        return true
      }

      return false
    })

    // Podcast fallback: search across all libraries
    if (matchingLibraries.length === 0 && type === 'PODCAST') {
      try {
        const url = `${creds.serverUrl}/Items?UserId=${creds.userId}&IncludeItemTypes=Series,MusicAlbum,Audio&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        const res = await fetch(url, {
          headers: { 'X-Emby-Token': creds.accessToken },
          signal: AbortSignal.timeout(15000),
        })

        if (res.ok) {
          const data = await res.json()
          const podcastItems = (data.Items || []).filter((item: any) => {
            const genres = (item.Genres || []).join(' ').toLowerCase()
            const name = (item.Name || '').toLowerCase()
            return genres.includes('podcast') || name.includes('podcast')
          })

          const items = podcastItems.map((item: any) =>
            mapJellyfinItem(item, type, 'podcasts', 'Podcasts')
          )
          const result: JellyfinCategoryResult = { items, totalRecordCount: items.length }
          try { await mediaCache.set(cacheKey, result, 120) } catch {}
          return result
        }
      } catch (err) {
        console.error('Podcast fallback search error:', err)
      }
    }

    if (matchingLibraries.length === 0) {
      return { items: [], totalRecordCount: 0 }
    }

    // Step 2: Fetch items from matching libraries recursively
    const allItems: any[] = []

    for (const lib of matchingLibraries) {
      try {
        let url: string

        if (type === 'MUSIC') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'PODCAST') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'TV_SHOW') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=Series&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'MOVIE') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=Movie&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'AUDIOBOOK') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=AudioBook&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'COLLECTION') {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&IncludeItemTypes=BoxSet&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else {
          url = `${creds.serverUrl}/Items?ParentId=${lib.Id}&UserId=${creds.userId}&Recursive=true&Fields=${COMMON_FIELDS}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        }

        const res = await fetch(url, {
          headers: { 'X-Emby-Token': creds.accessToken },
          signal: AbortSignal.timeout(15000),
        })

        if (res.ok) {
          const data = await res.json()
          const items = (data.Items || []).map((item: any) =>
            mapJellyfinItem(item, type, lib.CollectionType, lib.Name)
          )
          allItems.push(...items)
        }
      } catch (err) {
        console.error(`Error fetching from library ${lib.Name}:`, err)
      }
    }

    // For COLLECTION type: also try fetching BoxSets at the root level
    if (type === 'COLLECTION') {
      try {
        const url = `${creds.serverUrl}/Items?UserId=${creds.userId}&IncludeItemTypes=BoxSet&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,MediaSources&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        const res = await fetch(url, {
          headers: { 'X-Emby-Token': creds.accessToken },
          signal: AbortSignal.timeout(15000),
        })

        if (res.ok) {
          const data = await res.json()
          const rootItems = (data.Items || []).map((item: any) =>
            mapJellyfinItem(item, type, 'boxsets', '')
          )
          const existingIds = new Set(allItems.map(i => i.jellyfinId))
          for (const item of rootItems) {
            if (!existingIds.has(item.jellyfinId)) {
              allItems.push(item)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching root-level BoxSets:', err)
      }
    }

    const result: JellyfinCategoryResult = {
      items: allItems,
      totalRecordCount: allItems.length,
    }

    // Cache in DB for 2 minutes (non-fatal)
    try { await mediaCache.set(cacheKey, result, 120) } catch {}

    // Clean expired cache entries periodically
    if (Math.random() < 0.1) {
      mediaCache.cleanExpired().catch(() => {})
    }

    return result
  } catch (error) {
    console.error('Jellyfin category error:', error)
    return { items: [], totalRecordCount: 0 }
  }
}

/**
 * Fetch items from ALL Jellyfin categories (for the home page).
 * Returns a merged array with items from all types.
 */
export async function fetchAllJellyfinItems(limit: number = 20): Promise<any[]> {
  const types = ['MOVIE', 'TV_SHOW', 'MUSIC', 'PODCAST', 'AUDIOBOOK', 'COLLECTION']
  const allItems: any[] = []

  // Process in batches of 2 to avoid overwhelming the server
  for (let i = 0; i < types.length; i += 2) {
    const batch = types.slice(i, i + 2)
    const results = await Promise.allSettled(
      batch.map(async (t) => {
        const categoryResult = await fetchJellyfinCategoryItems(t, limit)
        return categoryResult.items || []
      })
    )
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value)
      }
    })
  }

  return allItems
}

// ──────────────────────────────────────────────
// Item mapping (shared between routes)
// ──────────────────────────────────────────────

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
