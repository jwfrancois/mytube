import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/library-items?parentId=xxx&sortBy=xxx&sortOrder=xxx&filterType=xxx&genre=xxx&year=xxx&startIndex=0&limit=50
 * Fetch items within a specific library with full sort/filter support.
 */
export async function GET(request: NextRequest) {
  try {
    const server = await getJellyfinCredentials()
    if (!server) {
      return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')
    const sortBy = searchParams.get('sortBy') || 'SortName'
    const sortOrder = searchParams.get('sortOrder') || 'Ascending'
    const filterType = searchParams.get('filterType') || ''
    const genre = searchParams.get('genre') || ''
    const year = searchParams.get('year') || ''
    const startIndex = searchParams.get('startIndex') || '0'
    const limit = searchParams.get('limit') || '100'
    const recursive = searchParams.get('recursive') || 'true'

    if (!parentId) {
      return NextResponse.json({ error: 'parentId is required' }, { status: 400 })
    }

    const fields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,BackdropImageTags,DateCreated,People,MediaSources,Tags,ProductionLocations,PremiereDate'

    let url = `${server.serverUrl}/Items?UserId=${server.userId}&ParentId=${parentId}&Recursive=${recursive}&Fields=${fields}&SortBy=${sortBy}&SortOrder=${sortOrder}&StartIndex=${startIndex}&Limit=${limit}`

    if (filterType) {
      url += `&IncludeItemTypes=${filterType}`
    }
    if (genre) {
      url += `&Genres=${encodeURIComponent(genre)}`
    }
    if (year) {
      url += `&Years=${year}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: `Jellyfin returned ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    const items = (data.Items || []).map((item: any) => {
      let type = 'MOVIE'
      if (item.Type === 'Series') type = 'TV_SHOW'
      else if (item.Type === 'Season') type = 'TV_SHOW'
      else if (item.Type === 'Episode') type = 'TV_SHOW'
      else if (item.Type === 'Audio' || item.Type === 'MusicAlbum') type = 'MUSIC'
      else if (item.Type === 'AudioBook') type = 'AUDIOBOOK'
      else if (item.Type === 'Book') type = 'BOOK'
      else if (item.Type === 'BoxSet') type = 'COLLECTION'

      const hasChildren = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'BoxSet' || item.IsFolder || (item.ChildCount && item.ChildCount > 0)

      let duration = ''
      if (item.RunTimeTicks) {
        const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
      }

      const actors: string[] = (item.People || [])
        .filter((p: any) => p.Type === 'Actor')
        .slice(0, 10)
        .map((p: any) => p.Name)

      const directors: string[] = (item.People || [])
        .filter((p: any) => p.Type === 'Director')
        .map((p: any) => p.Name)

      return {
        id: `jf-${item.Id}`,
        title: item.Name || 'Untitled',
        description: item.Overview || '',
        type,
        genre: (item.Genres || []).join(', '),
        thumbnail: item.ImageTags?.Primary
          ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
          : item.BackdropImageTags?.[0]
            ? `/api/jellyfin/image/${item.Id}?tag=${item.BackdropImageTags[0]}&type=Backdrop`
            : '',
        videoUrl: '',
        duration,
        durationTicks: item.RunTimeTicks || 0,
        releaseYear: item.ProductionYear || 0,
        artist: item.AlbumArtist || item.Artists?.[0] || item.Studios?.[0]?.Name || '',
        views: 0,
        channel: item.OfficialRating || server.name,
        createdAt: item.DateCreated || new Date().toISOString(),
        isJellyfin: true,
        jellyfinId: item.Id,
        itemType: item.Type,
        parentId: item.ParentId,
        hasChildren,
        childCount: item.ChildCount || 0,
        communityRating: item.CommunityRating,
        indexNumber: item.IndexNumber,
        parentIndexNumber: item.ParentIndexNumber,
        collectionType: item.CollectionType || '',
        studios: (item.Studios || []).map((s: any) => s.Name),
        actors,
        directors,
        tags: item.Tags || [],
        officialRating: item.OfficialRating || '',
        premiereDate: item.PremiereDate || '',
        isAudio: ['Audio', 'AudioBook', 'MusicAlbum'].includes(item.Type),
        isVideo: ['Movie', 'Episode', 'Video'].includes(item.Type),
        seriesName: item.SeriesName || '',
        seasonId: item.SeasonId || '',
        seriesId: item.SeriesId || '',
        episodeNumber: item.IndexNumber,
        seasonNumber: item.ParentIndexNumber,
      }
    })

    return NextResponse.json({
      items,
      totalRecordCount: data.TotalRecordCount || items.length,
      startIndex: parseInt(startIndex as string),
    })
  } catch (err) {
    console.error('Failed to fetch library items:', err)
    return NextResponse.json({ error: 'Failed to fetch library items' }, { status: 500 })
  }
}
