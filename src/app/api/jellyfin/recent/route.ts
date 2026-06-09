import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Cache for recently added items
const recentCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 120000 // 2 minutes

export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ items: [] })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ALL'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Check cache
    const cacheKey = `${type}-${limit}`
    const cached = recentCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    // Determine item types to fetch
    let includeItemTypes = 'Movie,Series'
    if (type === 'MOVIE') includeItemTypes = 'Movie'
    else if (type === 'TV_SHOW') includeItemTypes = 'Series'
    else if (type === 'MUSIC') includeItemTypes = 'MusicAlbum'
    else if (type === 'AUDIOBOOK') includeItemTypes = 'Book'
    else if (type === 'COLLECTION') includeItemTypes = 'BoxSet'
    else includeItemTypes = 'Movie,Series,MusicAlbum,Book,BoxSet'

    const params = new URLSearchParams({
      UserId: server.userId,
      Recursive: 'true',
      IncludeItemTypes: includeItemTypes,
      Fields: 'PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,CriticRating,OfficialRating,ChildCount,Studios,DateCreated',
      SortBy: 'DateCreated',
      SortOrder: 'Descending',
      Limit: String(limit),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${server.serverUrl}/Items?${params.toString()}`, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ items: [] })
    }

    const data = await res.json()
    const items = (data.Items || []).map((item: any) => mapRecentItem(item, server))

    const result = { items }
    recentCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Jellyfin recent error:', error)
    return NextResponse.json({ items: [] })
  }
}

function determineType(item: any): string {
  switch (item.Type) {
    case 'Series': return 'TV_SHOW'
    case 'Audio':
    case 'MusicAlbum':
    case 'MusicArtist': return 'MUSIC'
    case 'Book': return 'AUDIOBOOK'
    case 'BoxSet': return 'COLLECTION'
    case 'Movie': return 'MOVIE'
    default: return 'MOVIE'
  }
}

function mapRecentItem(item: any, server: any) {
  const type = determineType(item)
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
    genre: (item.Genres || []).join(', ') || 'Other',
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : '',
    videoUrl: '',
    duration,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || item.Artists?.join(', ') || '',
    views: 0,
    channel: item.OfficialRating || server.name,
    isJellyfin: true,
    jellyfinId: item.Id,
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren: item.Type === 'Series' || item.Type === 'MusicAlbum' || item.Type === 'BoxSet' || (item.ChildCount && item.ChildCount > 0),
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    officialRating: item.OfficialRating || '',
    libraryName: '',
    mediaType: type === 'MUSIC' || type === 'PODCAST' || type === 'AUDIOBOOK' ? 'audio' : 'video',
    dateCreated: item.DateCreated || '',
  }
}
