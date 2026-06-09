import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { mediaCache } from '@/lib/media-cache'

export async function GET(request: NextRequest) {
  try {
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')

    // Check cache (non-fatal)
    const cacheKey = `libraries-${parentId || 'root'}`
    try {
      const cached = await mediaCache.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    } catch {}

    let url: string
    if (parentId) {
      url = `${creds.serverUrl}/Items?ParentId=${parentId}&UserId=${creds.userId}&Recursive=false&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=200`
    } else {
      url = `${creds.serverUrl}/Users/${creds.userId}/Views`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      headers: {
        'X-Emby-Token': creds.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Jellyfin API error:', res.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch from Jellyfin' }, { status: res.status })
    }

    const data = await res.json()

    // Map items to our format
    const items = (data.Items || []).map((item: any) => {
      const collectionType = item.CollectionType || ''
      let type = 'MOVIE'
      if (collectionType === 'tvshows' || item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
        type = 'TV_SHOW'
      } else if (collectionType === 'music' || item.Type === 'Audio' || item.Type === 'MusicAlbum') {
        type = 'MUSIC'
      } else if (collectionType === 'podcasts') {
        type = 'PODCAST'
      } else if (collectionType === 'books') {
        type = 'AUDIOBOOK'
      } else if (item.Type === 'CollectionFolder' || item.Type === 'UserView') {
        type = collectionType === 'tvshows' ? 'TV_SHOW' : collectionType === 'music' ? 'MUSIC' : collectionType === 'podcasts' ? 'PODCAST' : collectionType === 'books' ? 'AUDIOBOOK' : 'MOVIE'
      } else if (item.Type === 'Movie') {
        type = 'MOVIE'
      } else if (item.Type === 'AudioBook') {
        type = 'AUDIOBOOK'
      }

      let duration = ''
      if (item.RunTimeTicks) {
        const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
      }

      const hasChildren = item.Type === 'CollectionFolder' || item.Type === 'UserView' || item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.IsFolder || (item.ChildCount && item.ChildCount > 0)

      return {
        id: item.Id,
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
        artist: item.Studios?.[0]?.Name || item.AlbumArtist || '',
        views: 0,
        channel: item.OfficialRating || 'Jellyfin',
        isJellyfin: true,
        jellyfinId: item.Id,
        itemType: item.Type,
        parentId: item.ParentId,
        hasChildren,
        childCount: item.ChildCount || 0,
        communityRating: item.CommunityRating,
        collectionType: item.CollectionType,
      }
    })

    const result = { items, totalRecordCount: data.TotalRecordCount }

    // Cache for 5 minutes (libraries change rarely, non-fatal)
    try { await mediaCache.set(cacheKey, result, 300) } catch {}

    return NextResponse.json(result)
  } catch (error) {
    console.error('Jellyfin libraries error:', error)
    return NextResponse.json({ error: 'Failed to fetch libraries' }, { status: 500 })
  }
}
