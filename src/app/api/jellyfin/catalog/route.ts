import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Per-type cache to avoid hitting Jellyfin server on every page load
const catalogCache = new Map<string, { items: any[]; libraries: any[]; timestamp: number }>()
const CACHE_TTL = 300000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ items: [], libraries: [] })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ALL'
    const genre = searchParams.get('genre')

    // Check per-type cache (but skip cache for specific type queries that returned 0 items,
    // so we can retry with fallback strategies)
    const cacheKey = genre ? `${type}-${genre}` : type
    const cached = catalogCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // If a specific type query was cached with 0 items, don't use the cache
      // (the library may have been added or updated since)
      if (type !== 'ALL' && cached.items.length === 0) {
        catalogCache.delete(cacheKey)
      } else {
        return NextResponse.json({ items: cached.items, libraries: cached.libraries })
      }
    }

    // Strategy: First get libraries, then fetch items within each library
    // This ensures we get ALL content properly organized by library

    // Step 1: Get user's libraries/views
    const libraries = await fetchLibraries(server)

    if (libraries.length === 0) {
      // Fallback: try direct Items query if no libraries found
      const fallbackItems = await fetchItemsDirectly(server, type, genre)
      return NextResponse.json({ items: fallbackItems, libraries: [] })
    }

    // Step 2: For each library, determine its type and fetch items
    // Use broader matching for specific type queries to avoid missing libraries
    // whose CollectionType might not match our mapLibraryType but could contain the requested content
    const fetchPromises: Promise<{ libraryId: string; libraryName: string; collectionType: string; items: any[] }>[] = []

    for (const lib of libraries) {
      const libType = mapLibraryType(lib.CollectionType, lib.Name)

      // Skip libraries that don't match the requested type filter
      if (type !== 'ALL' && type !== libType) {
        // Broader matching: also try libraries that might contain the requested type
        // e.g., a library with CollectionType='music' might contain podcasts,
        // or a library with CollectionType='podcasts' might have a name that doesn't match
        if (!isLibraryPossiblyOfType(lib, type)) continue
      }

      fetchPromises.push(
        fetchItemsInLibrary(server, lib.Id, lib.Name, lib.CollectionType, genre, 100, type)
          .then(items => ({ libraryId: lib.Id, libraryName: lib.Name, collectionType: lib.CollectionType || '', items }))
          .catch(err => {
            console.error(`Error fetching library ${lib.Name}:`, err)
            return { libraryId: lib.Id, libraryName: lib.Name, collectionType: lib.CollectionType || '', items: [] }
          })
      )
    }

    const results = await Promise.allSettled(fetchPromises)

    // Build library metadata
    const libraryMeta = libraries.map(lib => ({
      id: lib.Id,
      name: lib.Name,
      collectionType: lib.CollectionType || '',
      type: mapLibraryType(lib.CollectionType, lib.Name),
      itemCount: 0,
    }))

    // Collect all items
    const allItems: any[] = []

    results.forEach(r => {
      if (r.status === 'fulfilled') {
        allItems.push(...r.value.items)
        // Update library item count
        const meta = libraryMeta.find(m => m.id === r.value.libraryId)
        if (meta) meta.itemCount = r.value.items.length
      }
    })

    // Deduplicate by ID (same item can appear in multiple library views)
    const seenIds = new Set<string>()
    const dedupedItems = allItems.filter(item => {
      if (seenIds.has(item.id)) return false
      seenIds.add(item.id)
      return true
    })

    // Fallback: if a specific type query returned 0 items, try fetching ALL libraries
    // with broader item type queries
    if (type !== 'ALL' && dedupedItems.length === 0) {
      const fallbackItems = await fetchItemsDirectly(server, type, genre)
      if (fallbackItems.length > 0) {
        dedupedItems.push(...fallbackItems)
      }
    }

    // Sort alphabetically
    dedupedItems.sort((a: any, b: any) => a.title.localeCompare(b.title))

    // Cache results (always cache, even with 0 items for ALL type to avoid re-querying,
    // but specific type queries with 0 items are NOT cached so they can retry with fallbacks)
    if (type === 'ALL' || dedupedItems.length > 0) {
      catalogCache.set(cacheKey, { items: dedupedItems, libraries: libraryMeta, timestamp: Date.now() })
    }

    return NextResponse.json({ items: dedupedItems, libraries: libraryMeta })
  } catch (error) {
    console.error('Jellyfin catalog error:', error)
    return NextResponse.json({ items: [], libraries: [] })
  }
}

// Fetch user's libraries/views
async function fetchLibraries(server: { serverUrl: string; accessToken: string; userId: string }) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${server.serverUrl}/Users/${server.userId}/Views`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((item: any) => ({
      Id: item.Id,
      Name: item.Name,
      CollectionType: item.CollectionType || '',
      Type: item.Type,
    }))
  } catch (err) {
    console.error('Failed to fetch Jellyfin libraries:', err)
    return []
  }
}

// Map Jellyfin CollectionType + library name to our app type
// Some libraries like Podcasts have CollectionType='music' in Jellyfin,
// so we check the library name to disambiguate
function mapLibraryType(collectionType?: string, libraryName?: string): string {
  // Check library name first for known patterns (case-insensitive)
  const nameLower = (libraryName || '').toLowerCase()
  if (nameLower.includes('podcast')) return 'PODCAST'
  if (nameLower.includes('audiobook') || nameLower.includes('audio book')) return 'AUDIOBOOK'
  if (nameLower.includes('collection') || nameLower.includes('boxset')) return 'COLLECTION'

  if (!collectionType) return 'MOVIE'
  switch (collectionType.toLowerCase()) {
    case 'tvshows':
      return 'TV_SHOW'
    case 'music':
      return 'MUSIC'
    case 'movies':
      return 'MOVIE'
    case 'books':
      return 'AUDIOBOOK' // Audiobooks are NOT music
    case 'boxsets':
      return 'COLLECTION' // Movie collections are NOT just movies
    case 'playlists':
      return 'MUSIC'
    case 'podcasts':
      return 'PODCAST' // Podcasts are NOT music
    case 'livetv':
      return 'TV_SHOW'
    case 'homevideos':
      return 'MOVIE'
    default:
      return 'MOVIE'
  }
}

// Broader type matching: check if a library might contain items of the requested type
// even if mapLibraryType doesn't directly map it. This handles cases like:
// - A podcast library with CollectionType='music' that Jellyfin didn't label as 'podcasts'
// - A library with no CollectionType that might contain the requested content type
function isLibraryPossiblyOfType(lib: { CollectionType?: string; Name?: string }, requestedType: string): boolean {
  const collType = (lib.CollectionType || '').toLowerCase()
  const nameLower = (lib.Name || '').toLowerCase()

  switch (requestedType) {
    case 'PODCAST':
      // A music library might contain podcasts, a podcasts library might have any name,
      // and libraries with no CollectionType might also contain podcasts
      return collType === 'music' || collType === 'podcasts' || collType === '' ||
        nameLower.includes('podcast')
    case 'AUDIOBOOK':
      // Books or music libraries might contain audiobooks
      return collType === 'books' || collType === 'music' ||
        nameLower.includes('audiobook') || nameLower.includes('audio book')
    case 'MUSIC':
      // Music libraries and playlists might contain music
      return collType === 'music' || collType === 'playlists' ||
        nameLower.includes('music')
    case 'TV_SHOW':
      return collType === 'tvshows' || collType === 'livetv'
    case 'MOVIE':
      return collType === 'movies' || collType === 'homevideos'
    case 'COLLECTION':
      return collType === 'boxsets' ||
        nameLower.includes('collection') || nameLower.includes('boxset')
    default:
      return false
  }
}

// Fetch items within a specific library using ParentId
async function fetchItemsInLibrary(
  server: { serverUrl: string; accessToken: string; userId: string; name: string },
  libraryId: string,
  libraryName: string,
  collectionType: string,
  genre?: string | null,
  limit: number = 100,
  requestedType?: string
): Promise<any[]> {
  // Determine what item types to fetch based on library type
  let includeItemTypes: string
  const libType = collectionType?.toLowerCase() || ''
  const libNameLower = libraryName?.toLowerCase() || ''

  // Check if this is a podcast library - either by name OR by CollectionType
  // This handles both: name='Podcasts' and CollectionType='podcasts'
  const isPodcastLibrary = libNameLower.includes('podcast') || libType === 'podcasts'

  // Also treat music libraries as podcast libraries when PODCAST type is explicitly requested
  // This handles cases where Jellyfin stores podcasts in a music library
  const isPodcastRequested = requestedType === 'PODCAST'
  const isMusicLibrary = libType === 'music'

  if (isPodcastLibrary || (isPodcastRequested && isMusicLibrary)) {
    // Podcasts library - fetch top-level items (folders/series) first, NOT flat Audio tracks
    // This allows the UI to show podcast series that can be expanded to show episodes
    // We use Recursive=false to get only the top-level items
    return await fetchPodcastSeries(server, libraryId, libraryName, collectionType, limit)
  } else if (libNameLower.includes('audiobook') || libNameLower.includes('audio book')) {
    includeItemTypes = 'Book'
  } else if (libNameLower.includes('collection') || libNameLower.includes('boxset')) {
    includeItemTypes = 'BoxSet'
  } else if (libType === 'tvshows') {
    // Only fetch Series at top level - seasons/episodes are browsed when clicking a series
    includeItemTypes = 'Series'
  } else if (libType === 'music') {
    // Fetch albums at top level - tracks are inside albums
    includeItemTypes = 'MusicAlbum'
  } else if (libType === 'movies') {
    includeItemTypes = 'Movie'
  } else if (libType === 'boxsets') {
    // Fetch collections/boxsets at top level - movies inside are browsed when clicking
    includeItemTypes = 'BoxSet'
  } else if (libType === 'books') {
    // Fetch books (audiobooks) - these are playable directly
    includeItemTypes = 'Book'
  } else if (libType === 'playlists') {
    includeItemTypes = 'Playlist'
  } else {
    // Generic library - fetch movies and series
    includeItemTypes = 'Movie,Series,BoxSet'
  }

  const params = new URLSearchParams({
    ParentId: libraryId,
    UserId: server.userId,
    Recursive: 'true',
    IncludeItemTypes: includeItemTypes,
    Fields: 'PrimaryImageAspectRatio,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,Overview,OfficialRating,Studios,AlbumArtist,Artists,IndexNumber,ParentIndexNumber,MediaSources',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Limit: String(limit),
  })

  if (genre) {
    params.set('Genres', genre)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    const mapped = (data.Items || []).map((item: any) => mapJellyfinItem(item, server, libraryName, collectionType))
    // Post-fetch filter: ensure only items matching the expected type are returned
    // This handles cases where Jellyfin returns mixed types (e.g., BoxSet in Movies library)
    const expectedType = mapLibraryType(collectionType, libraryName)
    if (expectedType === 'MOVIE') {
      return mapped.filter((item: any) => item.type === 'MOVIE')
    }
    return mapped
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      console.error(`Jellyfin library fetch timeout for ${libraryName}`)
    } else {
      console.error(`Jellyfin library fetch error for ${libraryName}:`, err?.message || err)
    }
    return []
  }
}

// Fetch podcast series from a podcast library
// Jellyfin stores podcasts differently depending on version:
// - Some as folders containing Audio items
// - Some as Series with episodes
// - Some as flat Audio items grouped by Artist (most common for podcast libraries)
// We try the Artists endpoint first (best for flat audio libraries), then top-level
// folders, then Audio items grouped by Album/Artist
async function fetchPodcastSeries(
  server: { serverUrl: string; accessToken: string; userId: string; name: string },
  libraryId: string,
  libraryName: string,
  collectionType: string,
  limit: number = 100
): Promise<any[]> {
  // Strategy 1: Use Jellyfin's /Artists endpoint to get podcast shows
  // This works best for libraries with CollectionType='music' that contain flat Audio items
  // Each Artist represents a podcast show, and episodes can be fetched by ArtistIds
  try {
    const params = new URLSearchParams({
      ParentId: libraryId,
      UserId: server.userId,
      Fields: 'PrimaryImageAspectRatio,Overview',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      Limit: String(limit),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${server.serverUrl}/Artists?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const artists = data.Items || []

      if (artists.length > 0) {
        // Create virtual podcast series from artists
        const podcastSeries: any[] = []
        for (const artist of artists) {
          const virtualId = `pa-${artist.Id}`
          const libSuffix = libraryName ? `-${libraryName.replace(/\s+/g, '_').toLowerCase()}` : ''

          podcastSeries.push({
            id: `jf-${virtualId}${libSuffix}`,
            title: artist.Name || 'Unknown Podcast',
            description: artist.Overview || '',
            type: 'PODCAST',
            genre: 'Podcast',
            thumbnail: artist.ImageTags?.Primary
              ? `/api/jellyfin/image/${artist.Id}?tag=${artist.ImageTags.Primary}`
              : '',
            videoUrl: '',
            duration: '',
            releaseYear: 0,
            artist: artist.Name,
            views: 0,
            channel: libraryName || server.name,
            isJellyfin: true,
            jellyfinId: virtualId, // Virtual series ID based on artist
            itemType: 'MusicArtist',
            parentId: libraryId,
            hasChildren: true,
            childCount: 0, // Will be populated when episodes are fetched
            communityRating: artist.CommunityRating,
            indexNumber: undefined,
            parentIndexNumber: undefined,
            collectionType: collectionType,
            libraryName,
            mediaType: 'audio',
            // Store the artist ID for fetching episodes later
            _podcastArtistId: artist.Id,
            _parentId: libraryId,
          })
        }

        return podcastSeries
      }
    }
  } catch (err) {
    console.error('Podcast series fetch (Artists strategy) failed:', err)
  }

  // Strategy 2: Try fetching top-level items (folders/series) without recursion
  try {
    const params = new URLSearchParams({
      ParentId: libraryId,
      UserId: server.userId,
      Recursive: 'false',
      Fields: 'PrimaryImageAspectRatio,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,Overview,OfficialRating,Studios,AlbumArtist,Artists,IndexNumber,ParentIndexNumber,MediaSources',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      Limit: String(limit),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const items = data.Items || []

      if (items.length > 0) {
        // Filter for items that are folders/series (have children)
        const seriesItems = items.filter((item: any) =>
          item.IsFolder || item.Type === 'Series' || item.Type === 'CollectionFolder' ||
          item.Type === 'Folder' || (item.ChildCount && item.ChildCount > 0)
        )

        if (seriesItems.length > 0) {
          return seriesItems.map((item: any) => mapJellyfinItem(item, server, libraryName, collectionType))
        }

        // If no folder-type items, try the full items (might be Audio items grouped by Album)
        // Fall through to Strategy 3
      }
    }
  } catch (err) {
    console.error('Podcast series fetch (strategy 2) failed:', err)
  }

  // Strategy 3: Fetch Audio items and group by Album/Artist to create virtual series
  try {
    const params = new URLSearchParams({
      ParentId: libraryId,
      UserId: server.userId,
      Recursive: 'true',
      IncludeItemTypes: 'Audio',
      Fields: 'PrimaryImageAspectRatio,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,Overview,OfficialRating,Studios,AlbumArtist,Artists,IndexNumber,ParentIndexNumber,MediaSources',
      SortBy: 'Album,SortName',
      SortOrder: 'Ascending',
      Limit: String(limit * 3), // Get more items since we're grouping
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const audioItems = data.Items || []

      if (audioItems.length === 0) return []

      // Group by Album, then by AlbumArtist, then by first Artist as fallback
      const groupMap = new Map<string, { name: string; artist: string; items: any[] }>()
      for (const item of audioItems) {
        // Prefer Album, then AlbumArtist, then first Artist for grouping
        const groupKey = item.Album || item.AlbumArtist || (item.Artists && item.Artists[0]) || item.Name || 'Unknown Podcast'
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            name: groupKey,
            artist: item.AlbumArtist || (item.Artists && item.Artists.join(', ')) || '',
            items: [],
          })
        }
        groupMap.get(groupKey)!.items.push(item)
      }

      // Create virtual series items from groups
      const podcastSeries: any[] = []
      for (const [groupKey, group] of groupMap) {
        const firstItem = group.items[0]
        const virtualId = `ps-${firstItem.Id}`
        const libSuffix = libraryName ? `-${libraryName.replace(/\s+/g, '_').toLowerCase()}` : ''

        podcastSeries.push({
          id: `jf-${virtualId}${libSuffix}`,
          title: groupKey,
          description: firstItem.Overview || `Podcast series with ${group.items.length} episodes`,
          type: 'PODCAST',
          genre: (firstItem.Genres || []).join(', ') || 'Podcast',
          thumbnail: firstItem.ImageTags?.Primary
            ? `/api/jellyfin/image/${firstItem.Id}?tag=${firstItem.ImageTags.Primary}`
            : '',
          videoUrl: '',
          duration: '',
          releaseYear: firstItem.ProductionYear || 0,
          artist: group.artist,
          views: 0,
          channel: libraryName || server.name,
          isJellyfin: true,
          jellyfinId: virtualId, // Virtual series ID
          itemType: 'Series',
          parentId: libraryId,
          hasChildren: true,
          childCount: group.items.length,
          communityRating: firstItem.CommunityRating,
          indexNumber: undefined,
          parentIndexNumber: undefined,
          collectionType: collectionType,
          libraryName,
          mediaType: 'audio',
          // Store the actual Audio item IDs for fetching episodes later
          _podcastAudioIds: group.items.map((i: any) => i.Id),
          _podcastAlbumKey: groupKey,
          _parentId: libraryId,
        })
      }

      return podcastSeries
    }
  } catch (err) {
    console.error('Podcast series fetch (strategy 3) failed:', err)
  }

  // Strategy 4: Try fetching with genre filter "Podcast"
  try {
    const params = new URLSearchParams({
      ParentId: libraryId,
      UserId: server.userId,
      Recursive: 'true',
      IncludeItemTypes: 'Audio',
      Genres: 'Podcast',
      Fields: 'PrimaryImageAspectRatio,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,Overview,OfficialRating,Studios,AlbumArtist,Artists,IndexNumber,ParentIndexNumber,MediaSources',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      Limit: String(limit),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const podcastAudioItems = data.Items || []
      if (podcastAudioItems.length > 0) {
        console.log(`[Podcast Strategy 4] Found ${podcastAudioItems.length} audio items with genre 'Podcast' in library '${libraryName}'`)

        // Group by Album as in Strategy 3
        const groupMap = new Map<string, { name: string; artist: string; items: any[] }>()
        for (const item of podcastAudioItems) {
          const groupKey = item.Album || item.AlbumArtist || (item.Artists && item.Artists[0]) || item.Name || 'Unknown Podcast'
          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              name: groupKey,
              artist: item.AlbumArtist || (item.Artists && item.Artists.join(', ')) || '',
              items: [],
            })
          }
          groupMap.get(groupKey)!.items.push(item)
        }

        const podcastSeries: any[] = []
        for (const [groupKey, group] of groupMap) {
          const firstItem = group.items[0]
          const virtualId = `pg-${firstItem.Id}`
          const libSuffix = libraryName ? `-${libraryName.replace(/\s+/g, '_').toLowerCase()}` : ''

          podcastSeries.push({
            id: `jf-${virtualId}${libSuffix}`,
            title: groupKey,
            description: firstItem.Overview || `Podcast series with ${group.items.length} episodes`,
            type: 'PODCAST',
            genre: (firstItem.Genres || []).join(', ') || 'Podcast',
            thumbnail: firstItem.ImageTags?.Primary
              ? `/api/jellyfin/image/${firstItem.Id}?tag=${firstItem.ImageTags.Primary}`
              : '',
            videoUrl: '',
            duration: '',
            releaseYear: firstItem.ProductionYear || 0,
            artist: group.artist,
            views: 0,
            channel: libraryName || server.name,
            isJellyfin: true,
            jellyfinId: virtualId,
            itemType: 'Series',
            parentId: libraryId,
            hasChildren: true,
            childCount: group.items.length,
            communityRating: firstItem.CommunityRating,
            collectionType: collectionType,
            libraryName,
            mediaType: 'audio',
            _podcastAudioIds: group.items.map((i: any) => i.Id),
            _podcastAlbumKey: groupKey,
            _parentId: libraryId,
          })
        }

        return podcastSeries
      } else {
        console.log(`[Podcast Strategy 4] No audio items with genre 'Podcast' found in library '${libraryName}'`)
      }
    }
  } catch (err) {
    console.error('Podcast series fetch (strategy 4 - genre filter) failed:', err)
  }

  console.log(`[Podcast] All 4 strategies returned 0 items for library '${libraryName}' (collectionType='${collectionType}')`)
  return []
}

// Fallback: Direct items query without library scoping
async function fetchItemsDirectly(
  server: { serverUrl: string; accessToken: string; userId: string; name: string },
  type: string,
  genre?: string | null
): Promise<any[]> {
  const fetchPromises: Promise<any[]>[] = []

  if (type === 'ALL' || type === 'MOVIE') {
    fetchPromises.push(
      fetchItemsByType(server, 'Movie', genre, 100)
    )
  }

  if (type === 'ALL' || type === 'TV_SHOW') {
    fetchPromises.push(
      fetchItemsByType(server, 'Series', genre, 100)
    )
  }

  if (type === 'ALL' || type === 'MUSIC') {
    fetchPromises.push(
      fetchItemsByType(server, 'MusicAlbum', genre, 100)
    )
  }

  if (type === 'ALL' || type === 'PODCAST') {
    // Podcasts can be stored as Series or as Audio items (depending on Jellyfin setup)
    fetchPromises.push(
      fetchItemsByType(server, 'Series', genre, 100, 'podcasts')
    )
    fetchPromises.push(
      fetchItemsByType(server, 'Audio', genre, 100, 'podcasts')
    )
  }

  if (type === 'ALL' || type === 'AUDIOBOOK') {
    fetchPromises.push(
      fetchItemsByType(server, 'Book', genre, 100)
    )
  }

  if (type === 'ALL' || type === 'COLLECTION') {
    fetchPromises.push(
      fetchItemsByType(server, 'BoxSet', genre, 100)
    )
  }

  const results = await Promise.allSettled(fetchPromises)
  return results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

async function fetchItemsByType(
  server: { serverUrl: string; accessToken: string; userId: string; name: string },
  includeItemTypes: string,
  genre?: string | null,
  limit: number = 100,
  collectionType?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    UserId: server.userId,
    Recursive: 'true',
    IncludeItemTypes: includeItemTypes,
    Fields: 'PrimaryImageAspectRatio,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,Overview,OfficialRating,Studios,AlbumArtist,Artists,MediaSources',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Limit: String(limit),
  })

  if (genre) {
    params.set('Genres', genre)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((item: any) => mapJellyfinItem(item, server, '', collectionType || ''))
  } catch (err) {
    console.error(`Jellyfin catalog fetch error for ${includeItemTypes}:`, err)
    return []
  }
}

function mapJellyfinItem(item: any, server: any, libraryName: string, collectionType: string) {
  const collType = (item.CollectionType || collectionType || '').toLowerCase()
  const libNameLower = (libraryName || '').toLowerCase()
  let type = 'MOVIE'

  // Check library name first for disambiguation
  if (libNameLower.includes('podcast')) {
    type = 'PODCAST'
  } else if (libNameLower.includes('audiobook') || libNameLower.includes('audio book')) {
    type = 'AUDIOBOOK'
  } else if (libNameLower.includes('collection') || libNameLower.includes('boxset')) {
    type = 'COLLECTION'
  }
  // Determine type based on library collection type, then item type
  else if (collType === 'tvshows') {
    type = 'TV_SHOW'
  } else if (collType === 'podcasts') {
    type = 'PODCAST'
  } else if (collType === 'music') {
    type = 'MUSIC'
  } else if (collType === 'books') {
    type = 'AUDIOBOOK'
  } else if (collType === 'boxsets') {
    type = 'COLLECTION'
  } else {
    // Fallback: determine type from the item's own type
    if (item.Type === 'Series') {
      type = collType === 'podcasts' || libNameLower.includes('podcast') ? 'PODCAST' : 'TV_SHOW'
    } else if (item.Type === 'Season' || item.Type === 'Episode') {
      type = collType === 'podcasts' || libNameLower.includes('podcast') ? 'PODCAST' : 'TV_SHOW'
    } else if (item.Type === 'Audio' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist') {
      // Audio items in a podcasts library are podcast episodes
      type = collType === 'podcasts' || libNameLower.includes('podcast') ? 'PODCAST' : 'MUSIC'
    } else if (item.Type === 'Book') {
      type = 'AUDIOBOOK'
    } else if (item.Type === 'BoxSet') {
      type = 'COLLECTION'
    } else if (item.Type === 'Movie') {
      type = 'MOVIE'
    }
  }

  let duration = ''
  if (item.RunTimeTicks) {
    const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
  }

  // Items that contain children (navigable containers)
  const hasChildren = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.Type === 'CollectionFolder' || item.Type === 'UserView' || item.Type === 'BoxSet' || item.Type === 'Playlist' || item.IsFolder || (item.ChildCount && item.ChildCount > 0)

  // Make ID unique by including library name to avoid duplicate keys
  const libSuffix = libraryName ? `-${libraryName.replace(/\s+/g, '_').toLowerCase()}` : ''

  // Determine mediaType for player
  let mediaType = 'video'
  if (type === 'MUSIC' || type === 'PODCAST' || type === 'AUDIOBOOK') {
    mediaType = 'audio'
  }

  return {
    id: `jf-${item.Id}${libSuffix}`,
    title: item.Name || 'Untitled',
    description: item.Overview || '',
    type,
    genre: (item.Genres || []).join(', ') || 'Other',
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : '',
    videoUrl: '',
    duration,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || item.Artists?.join(', ') || item.Studios?.[0]?.Name || '',
    views: 0,
    channel: item.OfficialRating || libraryName || server.name,
    isJellyfin: true,
    jellyfinId: item.Id,
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren,
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    collectionType: item.CollectionType || collectionType,
    libraryName,
    mediaType,
  }
}
