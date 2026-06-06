import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const type = searchParams.get('type')

    if (!q.trim()) {
      return NextResponse.json({ media: [] })
    }

    const where: Record<string, unknown> = {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { artist: { contains: q } },
        { genre: { contains: q } },
        { channel: { contains: q } },
      ],
    }

    if (type) {
      where.type = type
    }

    const media = await db.media.findMany({
      where,
      orderBy: { views: 'desc' },
      take: 20,
    })

    // Also search Jellyfin if connected
    let jellyfinItems: any[] = []
    try {
      const server = await db.jellyfinServer.findFirst()
      if (server && server.connected) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const jellyfinRes = await fetch(
          `${server.serverUrl}/Items?UserId=${server.userId}&SearchTerm=${encodeURIComponent(q)}&IncludeItemTypes=Movie,Series,Audio,Episode,AudioBook,MusicAlbum,LiveTvChannel,LiveTvProgram,BoxSet&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=30`,
          {
            headers: { 'X-Emby-Token': server.accessToken },
            signal: controller.signal,
          }
        )

        clearTimeout(timeoutId)

        if (jellyfinRes.ok) {
          const jellyfinData = await jellyfinRes.json()
          // Get libraries to determine parent collection types for podcast detection
          const libraries = await getLibraries(server.serverUrl, server.userId, server.accessToken)

          jellyfinItems = (jellyfinData.Items || []).map((item: any) => {
            // Determine the parent library for this item to check its collection type
            const parentLib = libraries.find((lib: any) => {
              // Check if the item's ParentId matches the library Id
              // or if the item is nested under the library
              return item.ParentId === lib.Id
            })

            const parentCollectionType = parentLib?.CollectionType || ''
            const parentLibName = parentLib?.Name || ''

            let itemType = 'MOVIE'
            if (item.Type === 'Series') {
              // Check if it's in a podcast library
              if (isPodcastLibrary(parentCollectionType, parentLibName)) {
                itemType = 'PODCAST'
              } else {
                itemType = 'TV_SHOW'
              }
            }
            else if (item.Type === 'AudioBook') itemType = 'AUDIOBOOK'
            else if (item.Type === 'Audio' || item.Type === 'MusicAlbum') {
              if (isPodcastLibrary(parentCollectionType, parentLibName)) {
                itemType = 'PODCAST'
              } else {
                itemType = 'MUSIC'
              }
            }
            else if (item.Type === 'LiveTvChannel' || item.Type === 'LiveTvProgram') {
              itemType = 'PODCAST'
            }
            else if (item.Type === 'BoxSet') itemType = 'COLLECTION'

            let duration = ''
            if (item.RunTimeTicks) {
              const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
            }

            const hasChildren = item.Type === 'Series' || item.Type === 'Season' ||
              item.Type === 'MusicAlbum' || item.Type === 'BoxSet' || item.IsFolder ||
              (item.ChildCount && item.ChildCount > 0)

            return {
              id: `jf-${item.Id}`,
              title: item.Name || 'Untitled',
              description: item.Overview || '',
              type: itemType,
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
              collectionType: parentCollectionType,
            }
          })
        }
      }
    } catch (err) {
      console.error('Jellyfin search error (non-fatal):', err)
    }

    // Merge results: Jellyfin first, then local
    const allMedia = [...jellyfinItems, ...media]

    return NextResponse.json({ media: allMedia })
  } catch (error) {
    console.error('Error searching media:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

function isPodcastLibrary(collectionType: string, libraryName: string): boolean {
  return collectionType === 'podcasts' || /podcast/i.test(libraryName)
}

async function getLibraries(serverUrl: string, userId: string, accessToken: string): Promise<any[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(`${serverUrl}/Users/${userId}/Views`, {
      headers: { 'X-Emby-Token': accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      return data.Items || []
    }
    return []
  } catch {
    return []
  }
}
