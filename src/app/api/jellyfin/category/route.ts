import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Fetch Jellyfin items by media category type.
 * Maps our MediaType to Jellyfin library CollectionType and fetches items recursively.
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
// When a collectionType matches multiple types, use name patterns to disambiguate
const TYPE_TO_NAME_PATTERNS: Record<string, RegExp[]> = {
  PODCAST: [/podcast/i, /talk/i, /radio/i, /show/i],
  MUSIC: [], // No name filter — matches any library with 'music' collectionType not matched by other patterns
  COLLECTION: [/collection/i],
}

// Name patterns to EXCLUDE for a type (libraries that match collectionType but should be excluded)
const TYPE_TO_EXCLUDE_NAME_PATTERNS: Record<string, RegExp[]> = {
  MUSIC: [/podcast/i, /talk/i, /radio/i], // Exclude podcast-like libraries from Music category
}

const TYPE_TO_ITEM_TYPES: Record<string, string> = {
  MOVIE: 'Movie',
  TV_SHOW: 'Series',
  MUSIC: 'MusicAlbum,Audio',
  PODCAST: 'Series,Audio,LiveTvChannel,LiveTvProgram',
  AUDIOBOOK: 'AudioBook,Audio',
  COLLECTION: 'BoxSet',
}

export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!type) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    const collectionTypes = TYPE_TO_COLLECTION_TYPE[type]
    const includeItemTypes = TYPE_TO_ITEM_TYPES[type]

    if (!collectionTypes) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    // Step 1: Get top-level libraries/views to find matching ones
    const viewsController = new AbortController()
    const viewsTimeout = setTimeout(() => viewsController.abort(), 10000)

    const viewsRes = await fetch(`${server.serverUrl}/Users/${server.userId}/Views`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: viewsController.signal,
    })
    clearTimeout(viewsTimeout)

    if (!viewsRes.ok) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    const viewsData = await viewsRes.json()
    const libraries = (viewsData.Items || []) as any[]

    // Find libraries matching our type
    // Strategy: match by collectionType first, then by name pattern for disambiguation
    // Also: for PODCAST, any library with "podcast" in the name matches regardless of CollectionType
    const namePatterns = TYPE_TO_NAME_PATTERNS[type] || []
    const excludePatterns = TYPE_TO_EXCLUDE_NAME_PATTERNS[type] || []
    const matchingLibraries = libraries.filter((lib: any) => {
      const libCollectionType = lib.CollectionType || ''
      const libName = lib.Name || ''

      // Exclude libraries that match exclude patterns
      if (excludePatterns.length > 0 && excludePatterns.some(pattern => pattern.test(libName))) {
        return false
      }

      // Match by collectionType
      if (collectionTypes.includes(libCollectionType)) {
        // For types with name patterns, also require the name to match
        // (e.g., 'music' collectionType could be Music or Podcasts)
        if (namePatterns.length > 0) {
          return namePatterns.some(pattern => pattern.test(libName))
        }
        return true
      }

      // For PODCAST: also match any library with "podcast" in the name regardless of CollectionType
      if (type === 'PODCAST' && /podcast/i.test(libName)) {
        return true
      }

      return false
    })

    if (matchingLibraries.length === 0 && type === 'PODCAST') {
      // Fallback: No dedicated podcast library found.
      // Search ALL libraries for podcast-like content (items with "podcast" in genres or name)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        const commonFields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount'

        // Search across all items for podcast-like content
        const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=Series,MusicAlbum,Audio&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const data = await res.json()
          // Filter items that look like podcasts (by genre or name)
          const podcastItems = (data.Items || []).filter((item: any) => {
            const genres = (item.Genres || []).join(' ').toLowerCase()
            const name = (item.Name || '').toLowerCase()
            return genres.includes('podcast') || name.includes('podcast')
          })

          const items = podcastItems.map((item: any) =>
            mapJellyfinItem(item, type, 'podcasts', 'Podcasts')
          )
          return NextResponse.json({ items, totalRecordCount: items.length })
        }
      } catch (err) {
        console.error('Podcast fallback search error:', err)
      }
    }

    if (matchingLibraries.length === 0) {
      return NextResponse.json({ items: [], totalRecordCount: 0 })
    }

    // Step 2: Fetch items from matching libraries recursively
    const allItems: any[] = []

    for (const lib of matchingLibraries) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        let url: string
        const commonFields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount'

        if (type === 'MUSIC') {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'PODCAST') {
          // For podcasts, the library uses 'music' collectionType
          // Podcast shows are stored as MusicAlbum in music-type libraries.
          // Only request MusicAlbum type for performance (no Series/LiveTv needed for typical podcasts)
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'TV_SHOW') {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=Series&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'MOVIE') {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=Movie&Recursive=true&Fields=${commonFields},MediaSources,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'AUDIOBOOK') {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=AudioBook&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'COLLECTION') {
          // BoxSet (movie collections) — can exist at the root level or inside libraries
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=BoxSet&Recursive=true&Fields=${commonFields},MediaSources&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&Recursive=true&Fields=${commonFields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        }

        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

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

    // For COLLECTION type: also try fetching BoxSets at the root level (no ParentId filter)
    // Some Jellyfin setups have BoxSets that don't belong to a specific library
    if (type === 'COLLECTION') {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=BoxSet&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,MediaSources&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (res.ok) {
          const data = await res.json()
          const rootItems = (data.Items || []).map((item: any) =>
            mapJellyfinItem(item, type, 'boxsets', '')
          )
          // Deduplicate: only add items not already in allItems
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

    return NextResponse.json({
      items: allItems,
      totalRecordCount: allItems.length,
    })
  } catch (error) {
    console.error('Jellyfin category error:', error)
    return NextResponse.json({ items: [], totalRecordCount: 0 })
  }
}

function mapJellyfinItem(item: any, requestType: string, collectionType: string, libraryName: string = '') {
  // Determine the proper type for this item
  let type = requestType
  // Override for specific item types in specific libraries
  // Check both collectionType and library name for podcast detection
  const isPodcastLibrary = collectionType === 'podcasts' || /podcast/i.test(libraryName)
  if (isPodcastLibrary) {
    if (item.Type === 'Series') type = 'PODCAST'
    else if (item.Type === 'Audio') type = 'PODCAST'
    else if (item.Type === 'MusicAlbum') type = 'PODCAST'
    else if (item.Type === 'LiveTvChannel') type = 'PODCAST'
    else if (item.Type === 'LiveTvProgram') type = 'PODCAST'
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
