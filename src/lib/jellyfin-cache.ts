/**
 * Server-side in-memory cache for Jellyfin category items.
 *
 * Fetches ALL content types from Jellyfin:
 * - Movies, Series (with seasons/episodes), Audio, MusicAlbum
 * - AudioBooks, Books, BoxSets (Collections), Playlists
 * - Photos, Channels, Trailers, LiveTVChannels
 *
 * Library-aware fetching:
 * - Detects library CollectionTypes (movies, tvshows, music, podcasts, etc.)
 * - PODCAST category only fetches from libraries with CollectionType "podcasts"
 * - TV_SHOW category only fetches from libraries with CollectionType "tvshows"
 * - This prevents podcasts from appearing in TV shows and vice versa
 *
 * Server ID: 363ac50118644e63bddcd34c6dc063a9
 */

import { getJellyfinCredentials, setCredentialsFromClient, ClientCredentials } from '@/lib/jellyfin-credentials'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CachedCategory {
  items: any[]
  fetchedAt: number
  fetching: boolean
}

interface JellyfinLibrary {
  id: string
  name: string
  collectionType: string // 'movies', 'tvshows', 'music', 'books', 'podcasts', 'homevideos', etc.
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000

// Library info cache TTL (10 minutes – libraries rarely change)
const LIBRARY_CACHE_TTL = 10 * 60 * 1000

// Request timeout for Jellyfin API calls (10 seconds, not 30)
const REQUEST_TIMEOUT = 10000

const cache = new Map<string, CachedCategory>()

// ─── Library Info Cache ────────────────────────────────────────────────────

// Cached library info so we can determine which library to query for each category
let librariesCache: JellyfinLibrary[] = []
let librariesFetchedAt = 0
let librariesFetching = false

/**
 * Fetch the list of Jellyfin libraries (views) for the connected user.
 * Each library has an Id and a CollectionType (e.g. 'movies', 'tvshows', 'podcasts').
 * Results are cached for LIBRARY_CACHE_TTL.
 */
async function fetchLibraries(): Promise<JellyfinLibrary[]> {
  // Return cached if still fresh
  if (librariesCache.length > 0 && Date.now() - librariesFetchedAt < LIBRARY_CACHE_TTL) {
    return librariesCache
  }

  // Prevent concurrent fetches
  if (librariesFetching) {
    // Wait a bit and return whatever we have
    await new Promise((r) => setTimeout(r, 500))
    return librariesCache
  }

  librariesFetching = true

  try {
    const server = await getJellyfinCredentials()
    if (!server) {
      return librariesCache
    }

    const url = `${server.serverUrl}/Users/${server.userId}/Views`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error(`Failed to fetch Jellyfin libraries: ${res.status}`)
      return librariesCache
    }

    const data = await res.json()
    const libs: JellyfinLibrary[] = (data.Items || []).map((item: any) => ({
      id: item.Id,
      name: item.Name,
      collectionType: item.CollectionType || '',
    }))

    librariesCache = libs
    librariesFetchedAt = Date.now()
    return libs
  } catch (err) {
    console.error('Failed to fetch Jellyfin libraries:', err)
    return librariesCache
  } finally {
    librariesFetching = false
  }
}

/**
 * Get IDs of libraries matching a given CollectionType.
 * Returns empty array if no match (will cause fallback to non-library-specific fetch).
 */
async function getLibraryIdsByType(collectionType: string): Promise<string[]> {
  const libs = await fetchLibraries()
  return libs.filter((lib) => lib.collectionType === collectionType).map((lib) => lib.id)
}

/**
 * Get IDs of libraries matching a given CollectionType OR name.
 * Some Jellyfin servers use generic collection types (e.g. "music")
 * for podcast libraries, so we also match by library name.
 */
async function getLibraryIdsByTypeOrName(collectionType: string, nameMatches: string[]): Promise<string[]> {
  const libs = await fetchLibraries()
  return libs
    .filter((lib) =>
      lib.collectionType === collectionType ||
      nameMatches.some((name) => lib.name.toLowerCase().includes(name.toLowerCase()))
    )
    .map((lib) => lib.id)
}

/**
 * Get all known podcast library IDs (cached).
 * Useful for checking if a Series belongs to a podcast library.
 * Detects by both CollectionType "podcasts" and library name containing "podcast".
 */
export async function getPodcastLibraryIds(): Promise<string[]> {
  return getLibraryIdsByTypeOrName('podcasts', ['podcast'])
}

// ─── Cache Helpers ─────────────────────────────────────────────────────────

function getCacheKey(type: string): string {
  return `jellyfin-${type}`
}

function isStale(entry: CachedCategory): boolean {
  return Date.now() - entry.fetchedAt > CACHE_TTL
}

// ─── Type Mapping ──────────────────────────────────────────────────────────

/**
 * Map our app category types to Jellyfin IncludeItemTypes.
 * For PODCAST and TV_SHOW, library-aware fetching is handled separately
 * in fetchAndCache(), so this function returns the base item types.
 */
function getJellyfinItemType(type: string): string {
  switch (type) {
    case 'MOVIE':
      return 'Movie'
    case 'TV_SHOW':
      return 'Series'
    case 'MUSIC':
      return 'Audio,MusicAlbum'
    case 'AUDIOBOOK':
      return 'AudioBook'
    case 'BOOK':
      return 'Book'
    case 'PODCAST':
      return 'Series' // Podcasts are stored as Series in Jellyfin – filtered by library
    case 'COLLECTION':
      return 'BoxSet'
    case 'EPISODE':
      return 'Episode'
    case 'SEASON':
      return 'Season'
    case 'PLAYLIST':
      return 'Playlist'
    case 'PHOTO':
      return 'Photo,PhotoAlbum'
    case 'TRAILER':
      return 'Trailer'
    case 'ALL':
      return 'Movie,Series,Audio,MusicAlbum,AudioBook,Book,BoxSet,Playlist,Photo,Trailer'
    default:
      return ''
  }
}

/**
 * Determine the display type based on Jellyfin item type.
 * For Series items, checks against podcast library IDs to distinguish
 * podcasts from TV shows.
 */
async function mapJellyfinTypeToAppType(item: any): Promise<string> {
  // Check if this item belongs to a podcast library (by ParentId)
  const podcastLibIds = await getPodcastLibraryIds()
  const isInPodcastLibrary = podcastLibIds.length > 0 && item.ParentId && podcastLibIds.includes(item.ParentId)

  switch (item.Type) {
    case 'Movie':
    case 'Video':
      return 'MOVIE'
    case 'Series': {
      if (isInPodcastLibrary) return 'PODCAST'
      return 'TV_SHOW'
    }
    case 'Season':
      return 'TV_SHOW'
    case 'Episode': {
      // Episode could be a podcast episode if its series is a podcast
      if (isInPodcastLibrary) return 'PODCAST'
      return 'TV_SHOW'
    }
    case 'Audio': {
      // Audio items in a podcast library are podcast episodes
      if (isInPodcastLibrary) return 'PODCAST'
      return 'MUSIC'
    }
    case 'MusicAlbum': {
      // MusicAlbum in a podcast library is a podcast series/season
      if (isInPodcastLibrary) return 'PODCAST'
      return 'MUSIC'
    }
    case 'AudioBook':
      return 'AUDIOBOOK'
    case 'Book':
      return 'BOOK'
    case 'BoxSet':
      return 'COLLECTION'
    case 'Playlist':
      return 'MUSIC' // Playlists are typically music playlists
    case 'Photo':
    case 'PhotoAlbum':
      return 'PHOTO'
    case 'Trailer':
      return 'MOVIE'
    default:
      return 'MOVIE'
  }
}

/**
 * Determine if a Jellyfin item type is primarily audio content.
 * Podcasts are also audio content.
 */
function isAudioType(itemType: string, appType?: string): boolean {
  if (appType === 'PODCAST') return true
  return ['Audio', 'AudioBook', 'MusicAlbum'].includes(itemType)
}

/**
 * Determine if a Jellyfin item type is primarily video content.
 */
function isVideoType(itemType: string): boolean {
  return ['Movie', 'Episode', 'Video', 'Trailer'].includes(itemType)
}

// ─── Duration Formatting ───────────────────────────────────────────────────

/**
 * Format duration from ticks
 */
function formatDuration(ticks: number | undefined): string {
  if (!ticks) return ''
  const totalMinutes = Math.floor(ticks / 600000000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
}

// ─── Item Mapping ──────────────────────────────────────────────────────────

/**
 * Map a Jellyfin item to our app's MediaItem format with rich metadata.
 * Now includes isAudio and isVideo flags for the unified player.
 * @param forceType - If set, override the type detection (e.g. when fetching
 *   from a known podcast library, force all items to PODCAST type)
 */
async function mapJellyfinItem(item: any, serverName: string, forceType?: string): Promise<any> {
  const mappedType = forceType || await mapJellyfinTypeToAppType(item)

  const hasChildren =
    item.Type === 'Series' ||
    item.Type === 'Season' ||
    item.Type === 'MusicAlbum' ||
    item.Type === 'BoxSet' ||
    item.Type === 'PhotoAlbum' ||
    item.Type === 'Playlist' ||
    item.Type === 'AudioBook' ||
    item.IsFolder

  // Extract actors/directors from People field if available
  const actors: string[] = (item.People || [])
    .filter((p: any) => p.Type === 'Actor')
    .slice(0, 10)
    .map((p: any) => p.Name)

  const directors: string[] = (item.People || [])
    .filter((p: any) => p.Type === 'Director')
    .map((p: any) => p.Name)

  // Determine if this item is audio or video content
  const isAudio = isAudioType(item.Type, mappedType)
  const isVideo = isVideoType(item.Type)

  return {
    id: `jf-${item.Id}`,
    title: item.Name || 'Untitled',
    description: item.Overview || '',
    type: mappedType,
    genre: (item.Genres || []).join(', '),
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : item.BackdropImageTags?.[0]
        ? `/api/jellyfin/image/${item.Id}?tag=${item.BackdropImageTags[0]}&type=Backdrop`
        : '',
    videoUrl: '',
    duration: formatDuration(item.RunTimeTicks),
    durationTicks: item.RunTimeTicks || 0,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || item.Artists?.[0] || item.Studios?.[0]?.Name || '',
    views: 0,
    channel: item.OfficialRating || serverName,
    createdAt: item.DateCreated || new Date().toISOString(),
    // Jellyfin extensions
    isJellyfin: true,
    jellyfinId: item.Id,
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren,
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    // Media type flags for the unified player
    isAudio,
    isVideo,
    // Rich metadata
    studios: (item.Studios || []).map((s: any) => s.Name),
    actors,
    directors,
    tags: item.Tags || [],
    officialRating: item.OfficialRating || '',
    productionLocations: item.ProductionLocations || [],
    premiereDate: item.PremiereDate || '',
    // Audio-specific
    album: item.Album || '',
    albumArtist: item.AlbumArtist || '',
    audioCodec:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.Codec || '',
    channels:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.Channels || 0,
    sampleRate:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.SampleRate || 0,
    bitRate: item.MediaSources?.[0]?.Bitrate || 0,
    // Video-specific
    videoCodec:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Codec || '',
    width: item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Width || 0,
    height:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Height || 0,
    frameRate:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.RealFrameRate ||
      0,
    aspectRatio:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.AspectRatio ||
      '',
    // Series/Episode specific
    seriesName: item.SeriesName || item.Series?.Name || '',
    seasonName: item.SeasonName || '',
    seasonId: item.SeasonId || '',
    seriesId: item.SeriesId || '',
    episodeNumber: item.IndexNumber,
    seasonNumber: item.ParentIndexNumber,
    // Collection specific
    collectionType: item.CollectionType || '',
  }
}

// ─── Library-Aware Fetching ────────────────────────────────────────────────

/**
 * Fetch Jellyfin items from specific libraries by ParentId.
 * Used for PODCAST (podcast libraries) and TV_SHOW (tvshows libraries)
 * to ensure items only appear in the correct category.
 */
async function fetchItemsFromLibraries(
  server: { serverUrl: string; userId: string; accessToken: string; name: string },
  libraryIds: string[],
  includeItemTypes: string,
  fields: string,
  limit: number = 200
): Promise<any[]> {
  const allItems: any[] = []
  const seenIds = new Set<string>()

  for (const libraryId of libraryIds) {
    try {
      const url = `${server.serverUrl}/Items?UserId=${server.userId}&ParentId=${libraryId}&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=${fields}&SortBy=SortName&SortOrder=Ascending&Limit=${limit}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

      const res = await fetch(url, {
        headers: { 'X-Emby-Token': server.accessToken },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) continue

      const data = await res.json()
      for (const item of data.Items || []) {
        if (!seenIds.has(item.Id)) {
          seenIds.add(item.Id)
          allItems.push(item)
        }
      }
    } catch (err) {
      console.error(`Failed to fetch items from library ${libraryId}:`, err)
    }
  }

  return allItems
}

// ─── Main Fetch & Cache ────────────────────────────────────────────────────

/**
 * Fetch Jellyfin items for a given category and store in cache.
 * Accepts optional credentials directly (for Vercel serverless where
 * in-memory state is lost on cold start).
 *
 * If `credentials` is provided and the in-memory credential cache is empty,
 * the credentials are seeded into the in-memory cache before fetching.
 */
async function fetchAndCache(type: string, credentials?: ClientCredentials): Promise<any[]> {
  const key = getCacheKey(type)

  // Mark as fetching so we don't duplicate requests
  const existing = cache.get(key)
  if (existing?.fetching) return existing.items

  cache.set(key, { items: existing?.items || [], fetchedAt: existing?.fetchedAt || 0, fetching: true })

  try {
    // If credentials were passed directly, seed them into the in-memory cache
    // so getJellyfinCredentials() will find them.
    if (credentials) {
      setCredentialsFromClient(credentials)
    }

    const server = await getJellyfinCredentials()
    if (!server) {
      cache.set(key, { items: [], fetchedAt: Date.now(), fetching: false })
      return []
    }

    const includeItemTypes = getJellyfinItemType(type)
    if (!includeItemTypes) {
      cache.set(key, { items: [], fetchedAt: Date.now(), fetching: false })
      return []
    }

    // Request rich metadata from Jellyfin
    const fields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,People,MediaSources,Tags,ProductionLocations,PremiereDate,DateCreated,BackdropImageTags'

    let rawItems: any[]

    // ── Library-aware fetching for PODCAST and TV_SHOW ──────────

    if (type === 'PODCAST') {
      // Only fetch from podcast libraries (detected by CollectionType OR library name)
      const podcastLibIds = await getPodcastLibraryIds()

      if (podcastLibIds.length > 0) {
        // Podcasts in Jellyfin may be stored as Audio or Series depending on the setup.
        // Fetch both types to cover all podcast formats.
        const podcastItemTypes = 'Audio,MusicAlbum,Series'
        rawItems = await fetchItemsFromLibraries(server, podcastLibIds, podcastItemTypes, fields)

        // Map items with forceType='PODCAST' since we know these are from podcast libraries
        // (ParentId-based detection fails because Jellyfin doesn't always set it on leaf items)
        const seenIds = new Set<string>()
        const items: any[] = []
        for (const item of rawItems) {
          const mapped = await mapJellyfinItem(item, server.name, 'PODCAST')
          if (!seenIds.has(mapped.id)) {
            seenIds.add(mapped.id)
            items.push(mapped)
          }
        }
        cache.set(key, { items, fetchedAt: Date.now(), fetching: false })
        return items
      } else {
        // No podcast libraries found – return empty (don't mix with TV shows)
        cache.set(key, { items: [], fetchedAt: Date.now(), fetching: false })
        return []
      }
    } else if (type === 'TV_SHOW') {
      // Only fetch Series from tvshows libraries
      const tvshowLibIds = await getLibraryIdsByType('tvshows')

      if (tvshowLibIds.length > 0) {
        rawItems = await fetchItemsFromLibraries(server, tvshowLibIds, includeItemTypes, fields)
      } else {
        // Fallback: if no tvshows library is explicitly typed, fetch all Series
        // but exclude those from podcast libraries
        const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=${fields}&SortBy=SortName&SortOrder=Ascending&Limit=200`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          cache.set(key, { items: existing?.items || [], fetchedAt: Date.now(), fetching: false })
          return existing?.items || []
        }

        const data = await res.json()
        let items = data.Items || []

        // Filter out items that belong to podcast libraries
        const podcastLibIds = await getPodcastLibraryIds()
        if (podcastLibIds.length > 0) {
          items = items.filter((item: any) => !podcastLibIds.includes(item.ParentId))
        }

        rawItems = items
      }
    } else if (type === 'MUSIC') {
      // Fetch Audio/MusicAlbum only from MUSIC libraries, NOT from podcast libraries.
      // Both may have collectionType="music" in Jellyfin, so we exclude podcast-named libraries.
      const podcastLibIds = await getPodcastLibraryIds()
      const musicLibIds = await getLibraryIdsByType('music')

      // Filter out podcast library IDs from music library IDs
      const nonPodcastMusicLibIds = musicLibIds.filter((id) => !podcastLibIds.includes(id))

      if (nonPodcastMusicLibIds.length > 0) {
        // Fetch only from non-podcast music libraries
        rawItems = await fetchItemsFromLibraries(server, nonPodcastMusicLibIds, includeItemTypes, fields)
      } else {
        // Fallback: fetch all Audio/MusicAlbum and filter by parentId
        const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=${fields}&SortBy=SortName&SortOrder=Ascending&Limit=200`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          cache.set(key, { items: existing?.items || [], fetchedAt: Date.now(), fetching: false })
          return existing?.items || []
        }

        const data = await res.json()
        rawItems = data.Items || []

        // Filter out items that belong to podcast libraries
        if (podcastLibIds.length > 0) {
          rawItems = rawItems.filter((item: any) => !podcastLibIds.includes(item.ParentId))
        }
      }
    } else {
      // ── Standard fetching for all other types (BOOK, etc.) ────
      const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=${includeItemTypes}&Recursive=true&Fields=${fields}&SortBy=SortName&SortOrder=Ascending&Limit=200`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

      const res = await fetch(url, {
        headers: { 'X-Emby-Token': server.accessToken },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        cache.set(key, { items: existing?.items || [], fetchedAt: Date.now(), fetching: false })
        return existing?.items || []
      }

      const data = await res.json()
      rawItems = data.Items || []
    }

    // Map items and deduplicate by Jellyfin ID
    const seenIds = new Set<string>()
    const items: any[] = []

    for (const item of rawItems) {
      const mapped = await mapJellyfinItem(item, server.name)
      if (!seenIds.has(mapped.id)) {
        seenIds.add(mapped.id)
        items.push(mapped)
      }
    }

    cache.set(key, { items, fetchedAt: Date.now(), fetching: false })
    return items
  } catch (err) {
    console.error(`Failed to fetch Jellyfin items for ${type}:`, err)
    cache.set(key, { items: existing?.items || [], fetchedAt: Date.now(), fetching: false })
    return existing?.items || []
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get cached Jellyfin items for a category.
 *
 * If no cache exists yet AND credentials are provided, this will AWAIT the
 * Jellyfin fetch instead of returning empty immediately. This is critical for
 * Vercel serverless where the in-memory cache is lost on every cold start.
 *
 * If credentials are NOT provided (backward-compatible path), the old
 * fire-and-forget behavior is used.
 */
export async function getCachedJellyfinItems(
  type: string,
  credentials?: ClientCredentials
): Promise<{ items: any[]; stale: boolean }> {
  const key = getCacheKey(type)
  const entry = cache.get(key)

  if (!entry) {
    // First time: no cache at all.
    if (credentials) {
      // On Vercel serverless: AWAIT the fetch so we return real data.
      try {
        const items = await fetchAndCache(type, credentials)
        return { items, stale: false }
      } catch {
        return { items: [], stale: true }
      }
    }
    // No credentials provided – fire-and-forget (old behavior for local dev)
    fetchAndCache(type).catch(() => {})
    return { items: [], stale: true }
  }

  if (isStale(entry) && !entry.fetching) {
    // Cache is stale, trigger background refresh
    fetchAndCache(type, credentials).catch(() => {})
  }

  return { items: entry.items, stale: isStale(entry) }
}

/**
 * Force a refresh of the cache for a given type.
 * Accepts optional credentials for Vercel serverless.
 */
export async function refreshJellyfinCache(type: string, credentials?: ClientCredentials): Promise<any[]> {
  return fetchAndCache(type, credentials)
}

/**
 * Pre-warm the cache for ALL categories and library info.
 * Called on server startup or Jellyfin connection.
 * Accepts optional credentials for Vercel serverless.
 */
export function prewarmJellyfinCache(credentials?: ClientCredentials) {
  // Prewarm library info first, then all category caches
  fetchLibraries().then(() => {
    for (const type of ['MOVIE', 'TV_SHOW', 'MUSIC', 'AUDIOBOOK', 'BOOK', 'COLLECTION', 'PODCAST', 'ALL']) {
      fetchAndCache(type, credentials).catch(() => {})
    }
  }).catch(() => {
    // If library fetch fails, still try to prewarm with fallback behavior
    for (const type of ['MOVIE', 'TV_SHOW', 'MUSIC', 'AUDIOBOOK', 'BOOK', 'COLLECTION', 'PODCAST', 'ALL']) {
      fetchAndCache(type, credentials).catch(() => {})
    }
  })
}

/**
 * Fetch seasons for a given series ID.
 * This is a direct fetch, not cached (lightweight).
 */
export async function fetchSeriesSeasons(seriesId: string): Promise<any[]> {
  const server = await getJellyfinCredentials()
  if (!server) return []

  try {
    const url = `${server.serverUrl}/Items?UserId=${server.userId}&ParentId=${seriesId}&IncludeItemTypes=Season&SortBy=SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio,Overview,ChildCount`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((item: any) => mapJellyfinItemSync(item, server.name))
  } catch (err) {
    console.error(`Failed to fetch seasons for series ${seriesId}:`, err)
    return []
  }
}

/**
 * Fetch episodes for a given season ID.
 * This is a direct fetch, not cached.
 */
export async function fetchSeasonEpisodes(seasonId: string): Promise<any[]> {
  const server = await getJellyfinCredentials()
  if (!server) return []

  try {
    const url = `${server.serverUrl}/Items?UserId=${server.userId}&ParentId=${seasonId}&IncludeItemTypes=Episode&SortBy=SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio,Overview,RunTimeTicks,MediaSources,CommunityRating,DateCreated`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((item: any) => mapJellyfinItemSync(item, server.name))
  } catch (err) {
    console.error(`Failed to fetch episodes for season ${seasonId}:`, err)
    return []
  }
}

/**
 * Fetch items in a collection (BoxSet).
 */
export async function fetchCollectionItems(collectionId: string): Promise<any[]> {
  const server = await getJellyfinCredentials()
  if (!server) return []

  try {
    const url = `${server.serverUrl}/Items?UserId=${server.userId}&ParentId=${collectionId}&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,People&SortBy=SortName&SortOrder=Ascending&Limit=100`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((item: any) => mapJellyfinItemSync(item, server.name))
  } catch (err) {
    console.error(`Failed to fetch items for collection ${collectionId}:`, err)
    return []
  }
}

/**
 * Get all cached items across all types (for Home page).
 * Deduplicates by ID to prevent items from appearing twice
 * (e.g., a Movie in both MOVIE and ALL caches).
 */
export function getAllCachedJellyfinItems(): any[] {
  const seen = new Set<string>()
  const allItems: any[] = []
  for (const type of ['MOVIE', 'TV_SHOW', 'MUSIC', 'AUDIOBOOK', 'BOOK', 'COLLECTION', 'PODCAST']) {
    const entry = cache.get(getCacheKey(type))
    if (entry?.items) {
      for (const item of entry.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          allItems.push(item)
        }
      }
    }
  }
  return allItems
}

// ─── Synchronous Mapper (for direct/uncached fetches) ──────────────────────

/**
 * Synchronous version of mapJellyfinItem for use in direct (uncached) fetches
 * like fetchSeriesSeasons, fetchSeasonEpisodes, and fetchCollectionItems.
 * These endpoints don't need the async library-aware podcast detection
 * because the context is already known (user drilled into a specific series).
 */
function mapJellyfinItemSync(item: any, serverName: string): any {
  const mappedType = mapJellyfinTypeToAppTypeSync(item.Type)

  const hasChildren =
    item.Type === 'Series' ||
    item.Type === 'Season' ||
    item.Type === 'MusicAlbum' ||
    item.Type === 'BoxSet' ||
    item.Type === 'PhotoAlbum' ||
    item.Type === 'Playlist' ||
    item.Type === 'AudioBook' ||
    item.IsFolder

  const actors: string[] = (item.People || [])
    .filter((p: any) => p.Type === 'Actor')
    .slice(0, 10)
    .map((p: any) => p.Name)

  const directors: string[] = (item.People || [])
    .filter((p: any) => p.Type === 'Director')
    .map((p: any) => p.Name)

  const _isAudio = isAudioType(item.Type)
  const _isVideo = isVideoType(item.Type)

  return {
    id: `jf-${item.Id}`,
    title: item.Name || 'Untitled',
    description: item.Overview || '',
    type: mappedType,
    genre: (item.Genres || []).join(', '),
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : item.BackdropImageTags?.[0]
        ? `/api/jellyfin/image/${item.Id}?tag=${item.BackdropImageTags[0]}&type=Backdrop`
        : '',
    videoUrl: '',
    duration: formatDuration(item.RunTimeTicks),
    durationTicks: item.RunTimeTicks || 0,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || item.Artists?.[0] || item.Studios?.[0]?.Name || '',
    views: 0,
    channel: item.OfficialRating || serverName,
    createdAt: item.DateCreated || new Date().toISOString(),
    // Jellyfin extensions
    isJellyfin: true,
    jellyfinId: item.Id,
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren,
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    // Media type flags for the unified player
    isAudio: _isAudio,
    isVideo: _isVideo,
    // Rich metadata
    studios: (item.Studios || []).map((s: any) => s.Name),
    actors,
    directors,
    tags: item.Tags || [],
    officialRating: item.OfficialRating || '',
    productionLocations: item.ProductionLocations || [],
    premiereDate: item.PremiereDate || '',
    // Audio-specific
    album: item.Album || '',
    albumArtist: item.AlbumArtist || '',
    audioCodec:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.Codec || '',
    channels:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.Channels || 0,
    sampleRate:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Audio')?.SampleRate || 0,
    bitRate: item.MediaSources?.[0]?.Bitrate || 0,
    // Video-specific
    videoCodec:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Codec || '',
    width: item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Width || 0,
    height:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.Height || 0,
    frameRate:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.RealFrameRate ||
      0,
    aspectRatio:
      item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video')?.AspectRatio ||
      '',
    // Series/Episode specific
    seriesName: item.SeriesName || item.Series?.Name || '',
    seasonName: item.SeasonName || '',
    seasonId: item.SeasonId || '',
    seriesId: item.SeriesId || '',
    episodeNumber: item.IndexNumber,
    seasonNumber: item.ParentIndexNumber,
    // Collection specific
    collectionType: item.CollectionType || '',
  }
}

/**
 * Synchronous type mapping for direct/uncached fetches.
 * Does not perform podcast library detection (not needed for drill-down fetches).
 */
function mapJellyfinTypeToAppTypeSync(itemType: string): string {
  switch (itemType) {
    case 'Movie':
    case 'Video':
      return 'MOVIE'
    case 'Series':
      return 'TV_SHOW'
    case 'Season':
      return 'TV_SHOW'
    case 'Episode':
      return 'TV_SHOW'
    case 'Audio':
    case 'MusicAlbum':
      return 'MUSIC'
    case 'AudioBook':
      return 'AUDIOBOOK'
    case 'Book':
      return 'BOOK'
    case 'BoxSet':
      return 'COLLECTION'
    case 'Playlist':
      return 'MUSIC'
    case 'Photo':
    case 'PhotoAlbum':
      return 'PHOTO'
    case 'Trailer':
      return 'MOVIE'
    default:
      return 'MOVIE'
  }
}
