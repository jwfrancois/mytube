import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/search-nas?q=xxx
 * Search for items on the Jellyfin NAS server.
 * Returns results grouped by type (Movies, TV Shows, Music, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const server = await getJellyfinCredentials()
    if (!server) {
      return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    if (!query) {
      return NextResponse.json({ items: [], groups: {} })
    }

    const fields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,BackdropImageTags,DateCreated'
    const url = `${server.serverUrl}/Items?UserId=${server.userId}&SearchTerm=${encodeURIComponent(query)}&IncludeItemTypes=Movie,Series,Episode,Audio,MusicAlbum,AudioBook,Book,BoxSet,Season&Recursive=true&Fields=${fields}&SortBy=SortName&SortOrder=Ascending&Limit=50`

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
      else if (item.Type === 'Episode') type = 'TV_SHOW'
      else if (item.Type === 'Audio' || item.Type === 'MusicAlbum') type = 'MUSIC'
      else if (item.Type === 'AudioBook') type = 'AUDIOBOOK'
      else if (item.Type === 'Book') type = 'BOOK'
      else if (item.Type === 'BoxSet') type = 'COLLECTION'
      else if (item.Type === 'Season') type = 'TV_SHOW'

      const hasChildren = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'BoxSet' || item.IsFolder

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
        seriesName: item.SeriesName || '',
        seriesId: item.SeriesId || '',
        isAudio: ['Audio', 'AudioBook', 'MusicAlbum'].includes(item.Type),
        isVideo: ['Movie', 'Episode', 'Video'].includes(item.Type),
      }
    })

    // Group by type
    const groups: Record<string, any[]> = {}
    for (const item of items) {
      const groupKey = item.type
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(item)
    }

    return NextResponse.json({ items, groups, total: data.TotalRecordCount || items.length })
  } catch (err) {
    console.error('Failed to search NAS:', err)
    return NextResponse.json({ error: 'Failed to search NAS' }, { status: 500 })
  }
}
