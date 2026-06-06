import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// --- Types ---

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
  People?: { Name: string; Type: string; Role?: string }[]
  ParentId?: string
  IsFolder?: boolean
  ImageTags?: { Primary?: string }
  AlbumArtist?: string
  Artists?: string[]
  IndexNumber?: number
  ParentIndexNumber?: number
  CollectionType?: string
}

interface CollectionsRequest {
  collectionType: 'auto' | 'oscar' | 'cult_classic' | 'hidden_gems' | 'family' | 'decade_90s' | 'similar_to'
  referenceItemId?: string
}

interface SmartCollection {
  id: string
  title: string
  description: string
  items: ReturnType<typeof mapJellyfinItem>[]
  icon: string
}

// --- Type mapping (consistent with concierge) ---

function determineType(
  item: JellyfinItem,
  libraryCollectionTypes: Record<string, string>
): string {
  const parentCollectionType = libraryCollectionTypes[item.ParentId || ''] || ''

  if (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
    if (parentCollectionType === 'podcasts' || /podcast/i.test(item.Name || '')) {
      return 'PODCAST'
    }
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

function mapJellyfinItem(
  item: JellyfinItem,
  libraryCollectionTypes: Record<string, string>
) {
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

// --- Rule-based filtering helpers ---

function filterOscar(items: JellyfinItem[]): JellyfinItem[] {
  // High community rating, drama genres, acclaimed
  return items
    .filter((item) => {
      const rating = item.CommunityRating || 0
      const genres = (item.Genres || []).map((g) => g.toLowerCase())
      const isDrama = genres.some((g) =>
        ['drama', 'crime', 'thriller', 'biography', 'history'].includes(g)
      )
      return rating >= 7.5 && isDrama
    })
    .sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
    .slice(0, 15)
}

function filterCultClassic(items: JellyfinItem[]): JellyfinItem[] {
  // Older items (before 2005), notable but not mainstream
  return items
    .filter((item) => {
      const year = item.ProductionYear || 9999
      const rating = item.CommunityRating || 0
      const genres = (item.Genres || []).map((g) => g.toLowerCase())
      const isCultGenre = genres.some((g) =>
        ['horror', 'sci-fi', 'science fiction', 'fantasy', 'comedy', 'action'].includes(g)
      )
      return year < 2005 && year > 1960 && rating >= 6.5 && isCultGenre
    })
    .sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
    .slice(0, 15)
}

function filterHiddenGems(items: JellyfinItem[]): JellyfinItem[] {
  // Good ratings but lesser known — we use moderate rating as proxy
  return items
    .filter((item) => {
      const rating = item.CommunityRating || 0
      return rating >= 7.0 && rating < 8.5
    })
    .sort(() => Math.random() - 0.5) // randomize for discovery
    .slice(0, 15)
}

function filterFamily(items: JellyfinItem[]): JellyfinItem[] {
  // Family-friendly ratings
  const familyRatings = ['G', 'PG', 'TV-G', 'TV-Y', 'TV-Y7', 'TV-PG']
  return items
    .filter((item) => {
      const rating = item.OfficialRating || ''
      const genres = (item.Genres || []).map((g) => g.toLowerCase())
      const isFamilyGenre = genres.some((g) =>
        ['animation', 'family', 'kids', 'children'].includes(g)
      )
      return familyRatings.includes(rating) || isFamilyGenre
    })
    .slice(0, 15)
}

function filterDecade90s(items: JellyfinItem[]): JellyfinItem[] {
  return items
    .filter((item) => {
      const year = item.ProductionYear || 0
      return year >= 1990 && year <= 1999
    })
    .sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
    .slice(0, 15)
}

function filterSimilarTo(
  items: JellyfinItem[],
  referenceItem: JellyfinItem
): JellyfinItem[] {
  const refGenres = new Set((referenceItem.Genres || []).map((g) => g.toLowerCase()))
  const refPeople = new Set((referenceItem.People || []).map((p) => p.Name.toLowerCase()))
  const refStudios = new Set((referenceItem.Studios || []).map((s) => s.Name.toLowerCase()))

  return items
    .filter((item) => item.Id !== referenceItem.Id) // exclude the reference itself
    .map((item) => {
      let score = 0
      // Genre overlap
      const itemGenres = (item.Genres || []).map((g) => g.toLowerCase())
      for (const g of itemGenres) {
        if (refGenres.has(g)) score += 3
      }
      // People overlap
      const itemPeople = (item.People || []).map((p) => p.Name.toLowerCase())
      for (const p of itemPeople) {
        if (refPeople.has(p)) score += 2
      }
      // Studio overlap
      const itemStudios = (item.Studios || []).map((s) => s.Name.toLowerCase())
      for (const s of itemStudios) {
        if (refStudios.has(s)) score += 1
      }
      // Same type bonus
      if (item.Type === referenceItem.Type) score += 1
      return { item, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((entry) => entry.item)
}

// --- Auto collection generation via LLM ---

async function generateAutoCollections(
  items: JellyfinItem[],
  libraryCollectionTypes: Record<string, string>
): Promise<SmartCollection[]> {
  const catalog = items.slice(0, 300).map((item) => {
    const people = item.People || []
    const keyActors = people
      .filter((p) => p.Type === 'Actor')
      .slice(0, 2)
      .map((p) => p.Name)
    const keyDirectors = people
      .filter((p) => p.Type === 'Director')
      .slice(0, 1)
      .map((p) => p.Name)

    return {
      id: item.Id,
      name: item.Name,
      type: item.Type,
      genres: (item.Genres || []).slice(0, 4).join(', '),
      year: item.ProductionYear || null,
      rating: item.CommunityRating || null,
      desc: (item.Overview || '').slice(0, 120),
      actors: keyActors,
      director: keyDirectors,
      artist: item.AlbumArtist || (item.Artists || []).slice(0, 2).join(', '),
      officialRating: item.OfficialRating || null,
    }
  })

  try {
    const zai = await ZAI.create()

    const systemPrompt = `You are a smart media library curator. Given a catalog of available media items, generate 5-8 diverse and creative themed collections.

Each collection should:
- Have a clear, engaging theme (e.g., "Mind-Bending Sci-Fi", "Feel-Good Classics", "Director's Spotlight", "Hidden Gems of the 90s", "Epic Soundtracks")
- Include items that genuinely fit the theme
- Be diverse — don't repeat the same genre or era in every collection
- Use different angles: by genre, mood, era, quality, people, or concept

Return a JSON object with:
- "collections": array of objects, each with:
  - "id": short kebab-case id (e.g., "mind-bending-sci-fi")
  - "title": display name for the collection
  - "description": brief description of the collection theme (1 sentence)
  - "itemIds": array of item IDs in this collection (max 10 per collection)
  - "icon": suggested icon name from: award, film, music, tv, star, heart, globe, clock, sparkles, bookmark, zap, brain, sun, moon, coffee

IMPORTANT: Return ONLY valid JSON, no markdown or extra text. Only use item IDs from the provided catalog.`

    const userPrompt = `Generate themed collections from this catalog (${catalog.length} items):
${JSON.stringify(catalog)}`

    const llmPromise = zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const llmTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM timeout')), 30000)
    )

    const completion = await Promise.race([llmPromise, llmTimeoutPromise])
    const content = completion.choices[0]?.message?.content || ''

    // Parse JSON from LLM response
    let jsonStr = content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed.collections)) {
      throw new Error('Invalid LLM response structure')
    }

    const validIds = new Set(items.map((i) => i.Id))
    const itemsMap = new Map(items.map((i) => [i.Id, i]))

    return parsed.collections
      .filter((col: Record<string, unknown>) => {
        return (
          typeof col.id === 'string' &&
          typeof col.title === 'string' &&
          typeof col.description === 'string' &&
          Array.isArray(col.itemIds)
        )
      })
      .map((col: { id: string; title: string; description: string; itemIds: string[]; icon?: string }) => {
        const validItemIds = (col.itemIds as string[]).filter((id: string) => validIds.has(id))
        const collectionItems = validItemIds
          .map((id: string) => itemsMap.get(id))
          .filter((item): item is JellyfinItem => item !== undefined)
          .map((item) => mapJellyfinItem(item, libraryCollectionTypes))

        return {
          id: col.id,
          title: col.title,
          description: col.description,
          items: collectionItems,
          icon: col.icon || 'bookmark',
        }
      })
      .filter((col: SmartCollection) => col.items.length > 0)
  } catch (llmError) {
    console.error('LLM auto collections error, falling back to rule-based:', llmError)

    // Fallback: generate rule-based collections
    return generateRuleBasedCollections(items, libraryCollectionTypes)
  }
}

function generateRuleBasedCollections(
  items: JellyfinItem[],
  libraryCollectionTypes: Record<string, string>
): SmartCollection[] {
  const collections: SmartCollection[] = []

  const oscarItems = filterOscar(items)
  if (oscarItems.length > 0) {
    collections.push({
      id: 'award-winners',
      title: 'Award Winners',
      description: 'Highly acclaimed films and shows in your library',
      items: oscarItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
      icon: 'award',
    })
  }

  const hiddenGems = filterHiddenGems(items)
  if (hiddenGems.length > 0) {
    collections.push({
      id: 'hidden-gems',
      title: 'Hidden Gems',
      description: 'Great content you might have overlooked',
      items: hiddenGems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
      icon: 'sparkles',
    })
  }

  const familyItems = filterFamily(items)
  if (familyItems.length > 0) {
    collections.push({
      id: 'family-friendly',
      title: 'Family Friendly',
      description: 'Perfect for movie night with the whole family',
      items: familyItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
      icon: 'heart',
    })
  }

  const decade90s = filterDecade90s(items)
  if (decade90s.length > 0) {
    collections.push({
      id: '90s-classics',
      title: '90s Classics',
      description: 'The best of the 1990s',
      items: decade90s.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
      icon: 'clock',
    })
  }

  const cultItems = filterCultClassic(items)
  if (cultItems.length > 0) {
    collections.push({
      id: 'cult-classics',
      title: 'Cult Classics',
      description: 'Offbeat favorites with dedicated followings',
      items: cultItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
      icon: 'film',
    })
  }

  // By genre - find top genres
  const genreCount: Record<string, number> = {}
  for (const item of items) {
    for (const genre of item.Genres || []) {
      genreCount[genre] = (genreCount[genre] || 0) + 1
    }
  }
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre)

  for (const genre of topGenres) {
    const genreItems = items
      .filter((i) => (i.Genres || []).includes(genre))
      .sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0))
      .slice(0, 10)

    if (genreItems.length >= 3) {
      collections.push({
        id: genre.toLowerCase().replace(/\s+/g, '-'),
        title: `Best ${genre}`,
        description: `Top-rated ${genre} titles in your library`,
        items: genreItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
        icon: 'star',
      })
    }
  }

  return collections.slice(0, 8)
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: CollectionsRequest = await request.json()
    const { collectionType, referenceItemId } = body

    const validTypes = ['auto', 'oscar', 'cult_classic', 'hidden_gems', 'family', 'decade_90s', 'similar_to']
    if (!collectionType || !validTypes.includes(collectionType)) {
      return NextResponse.json(
        { error: `collectionType must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (collectionType === 'similar_to' && !referenceItemId) {
      return NextResponse.json(
        { error: 'referenceItemId is required for similar_to collection type' },
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

    // 3. Fetch ALL items from the library with full metadata
    let rawItems: JellyfinItem[] = []
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
        rawItems = allData.Items || []
      }
    } catch {
      // Continue with empty items
    }

    if (rawItems.length === 0) {
      return NextResponse.json({
        collections: [],
      })
    }

    // 4. Generate collections based on type
    let collections: SmartCollection[]

    if (collectionType === 'auto') {
      collections = await generateAutoCollections(rawItems, libraryCollectionTypes)
    } else if (collectionType === 'similar_to') {
      // Find the reference item
      const referenceItem = rawItems.find((i) => i.Id === referenceItemId)
      if (!referenceItem) {
        return NextResponse.json(
          { error: 'Reference item not found in your library' },
          { status: 404 }
        )
      }

      const similarItems = filterSimilarTo(rawItems, referenceItem)
      collections = [
        {
          id: 'similar-to',
          title: `Similar to ${referenceItem.Name}`,
          description: `If you liked ${referenceItem.Name}, you might enjoy these`,
          items: similarItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
          icon: 'bookmark',
        },
      ]
    } else {
      // Specific collection types using rule-based + optional LLM enhancement
      const filteredItems = collectionType === 'oscar'
        ? filterOscar(rawItems)
        : collectionType === 'cult_classic'
          ? filterCultClassic(rawItems)
          : collectionType === 'hidden_gems'
            ? filterHiddenGems(rawItems)
            : collectionType === 'family'
              ? filterFamily(rawItems)
              : filterDecade90s(rawItems)

      const collectionMeta: Record<string, { id: string; title: string; description: string; icon: string }> = {
        oscar: {
          id: 'oscar-winners',
          title: 'Oscar Winners',
          description: 'Acclaimed films in your library',
          icon: 'award',
        },
        cult_classic: {
          id: 'cult-classics',
          title: 'Cult Classics',
          description: 'Offbeat favorites with dedicated followings',
          icon: 'film',
        },
        hidden_gems: {
          id: 'hidden-gems',
          title: 'Hidden Gems',
          description: 'Great content you might have overlooked',
          icon: 'sparkles',
        },
        family: {
          id: 'family-friendly',
          title: 'Family Friendly',
          description: 'Perfect for movie night with the whole family',
          icon: 'heart',
        },
        decade_90s: {
          id: '90s-classics',
          title: '90s Classics',
          description: 'The best of the 1990s',
          icon: 'clock',
        },
      }

      const meta = collectionMeta[collectionType]
      collections = [
        {
          id: meta.id,
          title: meta.title,
          description: meta.description,
          items: filteredItems.map((i) => mapJellyfinItem(i, libraryCollectionTypes)),
          icon: meta.icon,
        },
      ]
    }

    return NextResponse.json({ collections })
  } catch (error) {
    console.error('AI Collections error:', error)
    return NextResponse.json(
      { error: 'Failed to generate collections' },
      { status: 500 }
    )
  }
}
