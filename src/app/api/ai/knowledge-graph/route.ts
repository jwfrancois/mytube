import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

interface JellyfinItem {
  Id: string
  Name: string
  Type: string
  Overview?: string
  Genres?: string[]
  Studios?: { Name: string }[]
  RunTimeTicks?: number
  ProductionYear?: number
  CommunityRating?: number
  OfficialRating?: string
  MediaSources?: { Id: string }[]
  ChildCount?: number
  People?: { Id?: string; Name: string; Type: string; Role?: string; PrimaryImageTag?: string }[]
  ParentId?: string
  IsFolder?: boolean
  ImageTags?: { Primary?: string }
  AlbumArtist?: string
  Artists?: string[]
  IndexNumber?: number
  ParentIndexNumber?: number
  CollectionType?: string
}

// --- Type mapping ---

function determineType(
  item: JellyfinItem,
  libraryCollectionTypes: Record<string, string>
): string {
  const parentCollectionType = libraryCollectionTypes[item.ParentId || ''] || ''
  if (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
    if (parentCollectionType === 'podcasts' || /podcast/i.test(item.Name || '')) return 'PODCAST'
    return 'TV_SHOW'
  }
  if (item.Type === 'AudioBook') return 'AUDIOBOOK'
  if (item.Type === 'LiveTvChannel' || item.Type === 'LiveTvProgram') return 'PODCAST'
  if (item.Type === 'Audio' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist') {
    if (parentCollectionType === 'podcasts') return 'PODCAST'
    if (parentCollectionType === 'books') return 'AUDIOBOOK'
    return 'MUSIC'
  }
  return 'MOVIE'
}

function mapJellyfinItem(item: JellyfinItem, libraryCollectionTypes: Record<string, string>) {
  const type = determineType(item, libraryCollectionTypes)
  const parentCollectionType = libraryCollectionTypes[item.ParentId || ''] || ''

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
    artist:
      item.Studios?.[0]?.Name ||
      item.AlbumArtist ||
      item.Artists?.join(', ') ||
      '',
    views: 0,
    channel: item.OfficialRating || '',
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId query parameter is required' },
        { status: 400 }
      )
    }

    // 1. Get Jellyfin credentials
    const server = await db.jellyfinServer.findFirst()
    if (!server || !server.connected) {
      return NextResponse.json(
        { error: 'Not connected to Jellyfin' },
        { status: 400 }
      )
    }

    // 2. Fetch library structure for type mapping
    let libraryCollectionTypes: Record<string, string> = {}
    try {
      const viewsController = new AbortController()
      const viewsTimeout = setTimeout(() => viewsController.abort(), 5000)
      const viewsRes = await fetch(
        `${server.serverUrl}/Users/${server.userId}/Views`,
        {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: viewsController.signal,
        }
      )
      clearTimeout(viewsTimeout)
      if (viewsRes.ok) {
        const viewsData = await viewsRes.json()
        for (const lib of viewsData.Items || []) {
          libraryCollectionTypes[lib.Id] = lib.CollectionType || ''
        }
      }
    } catch {
      // Continue without library type mapping
    }

    // 3. Fetch the central item's details with People
    const detailUrl = `${server.serverUrl}/Items?Ids=${itemId}&UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People,AlbumArtist,Artists`
    const detailController = new AbortController()
    const detailTimeout = setTimeout(() => detailController.abort(), 10000)
    const detailRes = await fetch(detailUrl, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: detailController.signal,
    })
    clearTimeout(detailTimeout)

    if (!detailRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch item details' }, { status: detailRes.status })
    }

    const detailData = await detailRes.json()
    const centralItem = detailData.Items?.[0] as JellyfinItem | undefined

    if (!centralItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const center = mapJellyfinItem(centralItem, libraryCollectionTypes)

    // 4. Extract people (actors + directors)
    const people = (centralItem.People || [])
      .filter(p => p.Type === 'Actor' || p.Type === 'Director')
      .slice(0, 10)
      .map(p => ({
        id: p.Id || `person-${p.Name}`,
        name: p.Name,
        role: p.Role || p.Type,
        type: p.Type,
        thumbnail: p.Id && p.PrimaryImageTag
          ? `/api/jellyfin/image/${p.Id}?tag=${p.PrimaryImageTag}`
          : '',
        items: [] as any[],
      }))

    // 5. Extract genres
    const genres = (centralItem.Genres || []).slice(0, 6).map(g => ({
      name: g,
      items: [] as any[],
    }))

    // 6. Fetch all items for related content matching
    let allItems: JellyfinItem[] = []
    try {
      const allUrl = `${server.serverUrl}/Items?UserId=${server.userId}&Recursive=true&IncludeItemTypes=Movie,Series,Audio,AudioBook&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People,AlbumArtist,Artists&SortBy=SortName&SortOrder=Ascending&Limit=500`
      const allController = new AbortController()
      const allTimeout = setTimeout(() => allController.abort(), 15000)
      const allRes = await fetch(allUrl, {
        headers: { 'X-Emby-Token': server.accessToken },
        signal: allController.signal,
      })
      clearTimeout(allTimeout)
      if (allRes.ok) {
        const allData = await allRes.json()
        allItems = allData.Items || []
      }
    } catch {
      // Continue with empty items
    }

    // 7. Build related items (same genre, same director/actor, excluding self)
    const centralGenres = new Set(centralItem.Genres || [])
    const centralPeopleNames = new Set(
      (centralItem.People || [])
        .filter(p => p.Type === 'Actor' || p.Type === 'Director')
        .slice(0, 5)
        .map(p => p.Name)
    )

    const related = allItems
      .filter(item => {
        if (item.Id === centralItem.Id) return false
        // Must share at least one genre or one person
        const itemGenres = new Set(item.Genres || [])
        const hasSharedGenre = [...centralGenres].some(g => itemGenres.has(g))
        const itemPeopleNames = new Set(
          (item.People || [])
            .filter(p => p.Type === 'Actor' || p.Type === 'Director')
            .slice(0, 5)
            .map(p => p.Name)
        )
        const hasSharedPerson = [...centralPeopleNames].some(p => itemPeopleNames.has(p))
        return hasSharedGenre || hasSharedPerson
      })
      .sort((a, b) => {
        // Score by overlap count
        const scoreA = (a.Genres || []).filter(g => centralGenres.has(g)).length +
          ((a.People || []).filter(p => centralPeopleNames.has(p.Name)).length * 2)
        const scoreB = (b.Genres || []).filter(g => centralGenres.has(g)).length +
          ((b.People || []).filter(p => centralPeopleNames.has(p.Name)).length * 2)
        return scoreB - scoreA
      })
      .slice(0, 12)
      .map(item => mapJellyfinItem(item, libraryCollectionTypes))

    // 8. Populate genre items (items sharing that genre, excluding the central item)
    for (const genre of genres) {
      genre.items = allItems
        .filter(item => {
          if (item.Id === centralItem.Id) return false
          return (item.Genres || []).includes(genre.name)
        })
        .slice(0, 6)
        .map(item => mapJellyfinItem(item, libraryCollectionTypes))
    }

    // 9. Populate people items (items featuring that person, excluding the central item)
    // For efficiency, we do this only for the top 5 people
    const peopleToFetch = people.slice(0, 5)
    for (const person of peopleToFetch) {
      person.items = allItems
        .filter(item => {
          if (item.Id === centralItem.Id) return false
          return (item.People || []).some(p => p.Name === person.name)
        })
        .slice(0, 6)
        .map(item => mapJellyfinItem(item, libraryCollectionTypes))
    }

    return NextResponse.json({
      center,
      people,
      genres,
      related,
    })
  } catch (error) {
    console.error('Knowledge Graph API error:', error)
    return NextResponse.json(
      { error: 'Failed to build knowledge graph' },
      { status: 500 }
    )
  }
}
