import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Fetch Jellyfin items by media category type.
 * Maps our MediaType to Jellyfin library CollectionType and fetches items recursively.
 *
 * Query params:
 *   type - MOVIE | TV_SHOW | MUSIC | PODCAST | AUDIOBOOK
 *   limit - max items to return (default 100)
 */

const TYPE_TO_COLLECTION_TYPE: Record<string, string[]> = {
  MOVIE: ['movies', 'homevideos'],
  TV_SHOW: ['tvshows'],
  MUSIC: ['music'],
  PODCAST: ['podcasts', 'music'], // Podcasts library may use 'music' collectionType
  AUDIOBOOK: ['books'],
}

// Library name patterns to match for each type (case-insensitive)
// When a collectionType matches multiple types, use name patterns to disambiguate
const TYPE_TO_NAME_PATTERNS: Record<string, RegExp[]> = {
  PODCAST: [/podcast/i],
  MUSIC: [], // No name filter — matches any library with 'music' collectionType not matched by other patterns
}

// Name patterns to EXCLUDE for a type (libraries that match collectionType but should be excluded)
const TYPE_TO_EXCLUDE_NAME_PATTERNS: Record<string, RegExp[]> = {
  MUSIC: [/podcast/i], // Exclude podcast libraries from Music category
}

const TYPE_TO_ITEM_TYPES: Record<string, string> = {
  MOVIE: 'Movie',
  TV_SHOW: 'Series',
  MUSIC: 'MusicAlbum,Audio',
  PODCAST: 'Series,Audio',
  AUDIOBOOK: 'AudioBook,Audio',
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
    // First by collectionType, then by name pattern (include/exclude)
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
      return false
    })

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
        if (type === 'MUSIC') {
          // For music, fetch albums (MusicAlbum) recursively
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'PODCAST') {
          // For podcasts, the library may use 'music' collectionType
          // Podcast shows are stored as MusicAlbum in music-type libraries
          // or as Series in podcast-type libraries
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=Series,MusicAlbum&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'TV_SHOW') {
          // For TV shows, fetch Series items
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=Series&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'MOVIE') {
          // For movies, fetch Movie items
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=Movie&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else if (type === 'AUDIOBOOK') {
          // For audiobooks, fetch AudioBook items
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&IncludeItemTypes=AudioBook&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
        } else {
          url = `${server.serverUrl}/Items?ParentId=${lib.Id}&UserId=${server.userId}&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`
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
  } else if (collectionType === 'books') {
    if (item.Type === 'AudioBook') type = 'AUDIOBOOK'
    else if (item.Type === 'Audio') type = 'AUDIOBOOK'
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
