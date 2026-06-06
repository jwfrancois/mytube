import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')
    const searchTerm = searchParams.get('search')
    const parentCollectionType = searchParams.get('collectionType') || ''

    let url: string

    if (searchTerm) {
      url = `${server.serverUrl}/Items?UserId=${server.userId}&SearchTerm=${encodeURIComponent(searchTerm)}&IncludeItemTypes=Movie,Series,Audio,Episode,AudioBook,LiveTvChannel,LiveTvProgram&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People&SortBy=SortName&SortOrder=Ascending&Limit=100`
    } else if (parentId) {
      url = `${server.serverUrl}/Items?ParentId=${parentId}&UserId=${server.userId}&Recursive=false&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People&SortBy=SortName&SortOrder=Ascending&Limit=200`
    } else {
      return NextResponse.json({ items: [] })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      headers: {
        'X-Emby-Token': server.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch items from Jellyfin' }, { status: res.status })
    }

    const data = await res.json()

    const items = (data.Items || []).map((item: any) => {
      let type = 'MOVIE'
      if (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
        // In a podcast library, Series are podcast shows
        type = parentCollectionType === 'podcasts' ? 'PODCAST' : 'TV_SHOW'
      } else if (item.Type === 'AudioBook') {
        type = 'AUDIOBOOK'
      } else if (item.Type === 'LiveTvChannel' || item.Type === 'LiveTvProgram') {
        type = 'PODCAST'
      } else if (item.Type === 'Audio' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist') {
        // In a podcast library, Audio items are podcast episodes
        // In a books library, Audio items are audiobooks
        if (parentCollectionType === 'podcasts') {
          type = 'PODCAST'
        } else if (parentCollectionType === 'books') {
          type = 'AUDIOBOOK'
        } else {
          type = 'MUSIC'
        }
      }

      let duration = ''
      if (item.RunTimeTicks) {
        const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
      }

      const hasChildren = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.IsFolder || (item.ChildCount && item.ChildCount > 0)

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
        artist: item.Studios?.[0]?.Name || item.AlbumArtist || item.Artists?.join(', ') || '',
        views: 0,
        channel: item.OfficialRating || server.name,
        isJellyfin: true,
        jellyfinId: item.Id,
        mediaSourceId: item.MediaSources?.[0]?.Id || '',
        itemType: item.Type,
        parentId: item.ParentId,
        hasChildren,
        childCount: item.ChildCount || 0,
        communityRating: item.CommunityRating,
        indexNumber: item.IndexNumber,
        parentIndexNumber: item.ParentIndexNumber,
        collectionType: item.CollectionType || parentCollectionType,
      }
    })

    return NextResponse.json({ items, totalRecordCount: data.TotalRecordCount })
  } catch (error) {
    console.error('Jellyfin items error:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}
