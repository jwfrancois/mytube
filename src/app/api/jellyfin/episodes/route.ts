import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const seriesId = searchParams.get('seriesId')
    const seasonId = searchParams.get('seasonId')
    const parentId = searchParams.get('parentId')
    const podcastParentId = searchParams.get('podcastParentId')
    const podcastAudioIds = searchParams.get('podcastAudioIds')
    const podcastArtistId = searchParams.get('podcastArtistId')
    const podcastLibraryId = searchParams.get('podcastLibraryId')

    if (!seriesId && !parentId && !podcastParentId && !podcastArtistId) {
      return NextResponse.json({ error: 'seriesId, parentId, podcastParentId, or podcastArtistId is required' }, { status: 400 })
    }

    // Strategy for artist-based podcast series (created from /Artists endpoint)
    if (podcastArtistId) {
      return await fetchPodcastEpisodesByArtist(server, podcastArtistId, podcastLibraryId)
    }

    // Strategy for virtual podcast series (created from album grouping)
    if (podcastParentId) {
      return await fetchPodcastEpisodes(server, podcastParentId, podcastAudioIds)
    }

    // Strategy 1: Use Jellyfin's Shows/{SeriesId}/Episodes endpoint (best for TV shows)
    if (seriesId && !seriesId.startsWith('ps-')) {
      return await fetchEpisodesViaShows(server, seriesId, seasonId)
    }

    // Strategy 2: Use Items?ParentId for podcasts, collections, and fallback
    if (parentId) {
      return await fetchChildrenViaItems(server, parentId)
    }

    // If seriesId starts with 'ps-' (virtual podcast), we need the podcastParentId
    // This shouldn't happen, but return empty as fallback
    return NextResponse.json({ episodes: [] })
  } catch (error) {
    console.error('Jellyfin episodes error:', error)
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 })
  }
}

// Fetch podcast episodes from a library
// Uses either specific audio IDs (from virtual podcast series) or fetches all Audio items
async function fetchPodcastEpisodes(
  server: { serverUrl: string; accessToken: string; userId: string },
  libraryId: string,
  podcastAudioIds?: string | null
) {
  const params = new URLSearchParams({
    UserId: server.userId,
    Recursive: 'true',
    IncludeItemTypes: 'Audio',
    Fields: 'PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,IndexNumber,ParentIndexNumber,Studios,OfficialRating,AlbumArtist,Artists',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Limit: '500',
  })

  // If we have specific audio IDs, use the Ids parameter to fetch only those items
  // This is much more efficient than fetching all audio items and filtering
  if (podcastAudioIds) {
    const ids = podcastAudioIds.split(',').filter(Boolean)
    if (ids.length > 0) {
      params.set('Ids', ids.join(','))
      params.delete('ParentId') // Not needed when using Ids
      params.delete('IncludeItemTypes') // Not needed when using Ids
    } else {
      params.set('ParentId', libraryId)
    }
  } else {
    params.set('ParentId', libraryId)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
    headers: { 'X-Emby-Token': server.accessToken },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    return NextResponse.json({ episodes: [] })
  }

  const data = await res.json()

  const episodes = (data.Items || []).map((item: any, index: number) => {
    let duration = ''
    if (item.RunTimeTicks) {
      const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
    }

    return {
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type: 'PODCAST',
      genre: (item.Genres || []).join(', ') || '',
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration,
      releaseYear: item.ProductionYear || 0,
      artist: item.AlbumArtist || item.Artists?.join(', ') || '',
      views: 0,
      channel: item.OfficialRating || '',
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: 'Audio',
      parentId: item.ParentId || libraryId,
      hasChildren: false,
      childCount: 0,
      communityRating: item.CommunityRating,
      indexNumber: item.IndexNumber || index + 1,
      parentIndexNumber: item.ParentIndexNumber,
      seriesId: item.SeriesId,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber || index + 1,
      libraryName: '',
      mediaType: 'audio',
    }
  })

  return NextResponse.json({ episodes })
}

// Fetch podcast episodes by artist ID
// Uses the ArtistIds parameter to filter Audio items by a specific podcast show
async function fetchPodcastEpisodesByArtist(
  server: { serverUrl: string; accessToken: string; userId: string },
  artistId: string,
  libraryId?: string | null
) {
  const params = new URLSearchParams({
    UserId: server.userId,
    Recursive: 'true',
    IncludeItemTypes: 'Audio',
    ArtistIds: artistId,
    Fields: 'PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,IndexNumber,ParentIndexNumber,Studios,OfficialRating,AlbumArtist,Artists,Album',
    SortBy: 'DateCreated',
    SortOrder: 'Descending',
    Limit: '200',
  })

  if (libraryId) {
    params.set('ParentId', libraryId)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
    headers: { 'X-Emby-Token': server.accessToken },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    return NextResponse.json({ episodes: [] })
  }

  const data = await res.json()
  const totalItems = data.TotalRecordCount || 0

  const episodes = (data.Items || []).map((item: any, index: number) => {
    let duration = ''
    if (item.RunTimeTicks) {
      const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
    }

    return {
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type: 'PODCAST',
      genre: (item.Genres || []).join(', ') || '',
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration,
      releaseYear: item.ProductionYear || 0,
      artist: item.AlbumArtist || item.Artists?.join(', ') || '',
      views: 0,
      channel: item.OfficialRating || '',
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: 'Audio',
      parentId: item.ParentId || libraryId || '',
      hasChildren: false,
      childCount: 0,
      communityRating: item.CommunityRating,
      indexNumber: item.IndexNumber || (totalItems - index), // Reverse order for newest first
      parentIndexNumber: item.ParentIndexNumber,
      seriesId: item.SeriesId,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber || (totalItems - index),
      libraryName: '',
      mediaType: 'audio',
    }
  })

  return NextResponse.json({ episodes, totalCount: totalItems })
}

async function fetchEpisodesViaShows(
  server: { serverUrl: string; accessToken: string; userId: string },
  seriesId: string,
  seasonId?: string | null
) {
  let url = `${server.serverUrl}/Shows/${seriesId}/Episodes?UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,IndexNumber,ParentIndexNumber,Studios,OfficialRating`

  if (seasonId) {
    url += `&SeasonId=${seasonId}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(url, {
    headers: { 'X-Emby-Token': server.accessToken },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    // Fallback: try Items?ParentId
    if (seasonId) {
      return await fetchChildrenViaItems(server, seasonId)
    }
    return NextResponse.json({ episodes: [] })
  }

  const data = await res.json()

  const episodes = (data.Items || []).map((item: any) => {
    let duration = ''
    if (item.RunTimeTicks) {
      const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
    }

    return {
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type: 'TV_SHOW',
      genre: (item.Genres || []).join(', ') || '',
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration,
      releaseYear: item.ProductionYear || 0,
      artist: '',
      views: 0,
      channel: item.OfficialRating || '',
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: item.Type || 'Episode',
      parentId: item.ParentId || item.SeasonId || '',
      hasChildren: false,
      childCount: 0,
      communityRating: item.CommunityRating,
      indexNumber: item.IndexNumber,
      parentIndexNumber: item.ParentIndexNumber,
      seriesId: item.SeriesId || seriesId,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber,
      libraryName: '',
      mediaType: 'video',
    }
  })

  return NextResponse.json({ episodes })
}

async function fetchChildrenViaItems(
  server: { serverUrl: string; accessToken: string; userId: string },
  parentId: string
) {
  const url = `${server.serverUrl}/Items?ParentId=${parentId}&UserId=${server.userId}&Recursive=false&Fields=PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,IndexNumber,ParentIndexNumber,ChildCount,Studios,OfficialRating,AlbumArtist,Artists,MediaSources&SortBy=SortName&SortOrder=Ascending&Limit=200`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(url, {
    headers: { 'X-Emby-Token': server.accessToken },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    return NextResponse.json({ episodes: [] })
  }

  const data = await res.json()

  const items = (data.Items || []).map((item: any) => {
    // Determine the proper type based on item type
    let type = 'MOVIE'
    let mediaType = 'video'

    if (item.Type === 'Episode') {
      type = 'TV_SHOW'
      mediaType = 'video'
    } else if (item.Type === 'Audio') {
      type = 'PODCAST' // If we're fetching children, it's likely a podcast episode
      mediaType = 'audio'
    } else if (item.Type === 'MusicAlbum') {
      type = 'MUSIC'
      mediaType = 'audio'
    } else if (item.Type === 'Book') {
      type = 'AUDIOBOOK'
      mediaType = 'audio'
    } else if (item.Type === 'Movie') {
      type = 'MOVIE'
      mediaType = 'video'
    } else if (item.Type === 'Season' || item.Type === 'Series') {
      type = 'TV_SHOW'
      mediaType = 'video'
    }

    let duration = ''
    if (item.RunTimeTicks) {
      const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
    }

    const hasChildren = item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'Series' || item.IsFolder || (item.ChildCount && item.ChildCount > 0)

    return {
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type,
      genre: (item.Genres || []).join(', ') || '',
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration,
      releaseYear: item.ProductionYear || 0,
      artist: item.AlbumArtist || item.Artists?.join(', ') || '',
      views: 0,
      channel: item.OfficialRating || '',
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: item.Type,
      parentId: item.ParentId || parentId,
      hasChildren,
      childCount: item.ChildCount || 0,
      communityRating: item.CommunityRating,
      indexNumber: item.IndexNumber,
      parentIndexNumber: item.ParentIndexNumber,
      seriesId: item.SeriesId,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber,
      libraryName: '',
      mediaType,
    }
  })

  return NextResponse.json({ episodes: items })
}
