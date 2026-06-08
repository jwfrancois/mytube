import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// --- Type mapping helpers (consistent with /api/jellyfin/items) ---

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
  People?: any[]
  ParentId?: string
  IsFolder?: boolean
  ImageTags?: { Primary?: string }
  AlbumArtist?: string
  Artists?: string[]
  IndexNumber?: number
  ParentIndexNumber?: number
  CollectionType?: string
}

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

// --- Keyword fallback ---

function keywordSearch(
  items: JellyfinItem[],
  query: string
): { itemIds: string[]; interpretation: string; suggestions: string[] } {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)

  if (terms.length === 0) {
    return {
      itemIds: [],
      interpretation: 'Query too short for keyword matching',
      suggestions: ['Try a more descriptive search'],
    }
  }

  const scored = items
    .map((item) => {
      const text = [
        item.Name,
        item.Overview,
        (item.Genres || []).join(' '),
        item.AlbumArtist,
        (item.Artists || []).join(' '),
        item.OfficialRating,
        String(item.ProductionYear || ''),
      ]
        .join(' ')
        .toLowerCase()

      let score = 0
      for (const term of terms) {
        if (text.includes(term)) score += 1
      }
      return { id: item.Id, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return {
    itemIds: scored.map((s) => s.id),
    interpretation: `Keyword search for: "${query}"`,
    suggestions: [
      'Try being more specific about genre or mood',
      'Mention a year or rating for better results',
    ],
  }
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const query: string = body.query || ''

    if (!query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // 1. Get Jellyfin credentials
    const creds = await getJellyfinCredentials()
    if (!creds || !creds.connected) {
      return NextResponse.json(
        { error: 'Not connected to Jellyfin' },
        { status: 400 }
      )
    }

    // 2. Fetch library structure for type mapping (with short timeout)
    let libraryCollectionTypes: Record<string, string> = {}
    try {
      const viewsController = new AbortController()
      const viewsTimeout = setTimeout(() => viewsController.abort(), 5000)

      const viewsRes = await fetch(
        `${creds.serverUrl}/Users/${creds.userId}/Views`,
        {
          headers: { 'X-Emby-Token': creds.accessToken },
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

    // 3. Try Jellyfin's built-in search first (much faster than fetching all items)
    let rawItems: JellyfinItem[] = []
    try {
      const searchUrl = `${creds.serverUrl}/Items?UserId=${creds.userId}&SearchTerm=${encodeURIComponent(query)}&Recursive=true&IncludeItemTypes=Movie,Series,Audio,AudioBook&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=50`

      const searchController = new AbortController()
      const searchTimeout = setTimeout(() => searchController.abort(), 10000)

      const searchRes = await fetch(searchUrl, {
        headers: { 'X-Emby-Token': creds.accessToken },
        signal: searchController.signal,
      })
      clearTimeout(searchTimeout)

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        rawItems = searchData.Items || []
      }
    } catch {
      // Jellyfin search failed, try fetching all items
    }

    // If Jellyfin search returned too few results, also fetch some popular items
    if (rawItems.length < 5) {
      try {
        const popularUrl = `${creds.serverUrl}/Items?UserId=${creds.userId}&Recursive=true&IncludeItemTypes=Movie,Series,Audio,AudioBook&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount&SortBy=CommunityRating&SortOrder=Descending&Limit=100`

        const popularController = new AbortController()
        const popularTimeout = setTimeout(() => popularController.abort(), 10000)

        const popularRes = await fetch(popularUrl, {
          headers: { 'X-Emby-Token': creds.accessToken },
          signal: popularController.signal,
        })
        clearTimeout(popularTimeout)

        if (popularRes.ok) {
          const popularData = await popularRes.json()
          const popularItems: JellyfinItem[] = popularData.Items || []
          // Merge, avoiding duplicates
          const existingIds = new Set(rawItems.map((i) => i.Id))
          for (const item of popularItems) {
            if (!existingIds.has(item.Id)) {
              rawItems.push(item)
            }
          }
        }
      } catch {
        // Continue with whatever we have
      }
    }

    if (rawItems.length === 0) {
      return NextResponse.json({
        items: [],
        interpretation: 'Could not connect to your media library',
        suggestions: ['Check your Jellyfin connection', 'Try a simpler search'],
      })
    }

    // 4. Build a condensed catalog for the LLM (keep it small for speed)
    const catalog = rawItems.slice(0, 150).map((item) => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      genres: (item.Genres || []).slice(0, 3).join(', '),
      year: item.ProductionYear || null,
      rating: item.CommunityRating || null,
      desc: (item.Overview || '').slice(0, 80),
      artist: item.AlbumArtist || (item.Artists || []).slice(0, 2).join(', '),
    }))

    // 5. Call LLM with timeout
    let llmResult: { itemIds: string[]; interpretation: string; suggestions: string[] }

    try {
      const zai = await ZAI.create()

      const systemPrompt = `You are an intelligent media concierge for a personal streaming library. Given a user's natural language request and a catalog of available media, find the best matches.

Return a JSON object with:
- "itemIds": array of item IDs that match the request (max 10)
- "interpretation": brief description of what the user is looking for
- "suggestions": array of 2-3 helpful suggestions

Only include items from the catalog that truly match. If no items match well, return an empty itemIds array and explain why in interpretation.

IMPORTANT: Return ONLY valid JSON, no markdown or extra text.`

      const userPrompt = `User request: "${query}"

Available catalog (${catalog.length} items):
${JSON.stringify(catalog)}`

      // Set a 20s timeout for LLM call
      const llmPromise = zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })

      const llmTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 20000)
      )

      const completion = await Promise.race([llmPromise, llmTimeoutPromise])

      const content = completion.choices[0]?.message?.content || ''

      // Parse JSON from LLM response - handle potential markdown wrapping
      let jsonStr = content.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      llmResult = JSON.parse(jsonStr)

      // Validate structure
      if (!Array.isArray(llmResult.itemIds)) llmResult.itemIds = []
      if (typeof llmResult.interpretation !== 'string')
        llmResult.interpretation = ''
      if (!Array.isArray(llmResult.suggestions)) llmResult.suggestions = []

      // Filter to only valid IDs
      const validIds = new Set(rawItems.map((i) => i.Id))
      llmResult.itemIds = llmResult.itemIds.filter(
        (id: string) => validIds.has(id)
      )
    } catch (llmError) {
      console.error('LLM concierge error, falling back to keyword search:', llmError)
      llmResult = keywordSearch(rawItems, query)
    }

    // 6. Map matching items to MediaItem format
    const matchedItems = rawItems
      .filter((item) => llmResult.itemIds.includes(item.Id))
      .map((item) => mapJellyfinItem(item, libraryCollectionTypes))

    // Preserve LLM ordering
    const itemsMap = new Map(matchedItems.map((item) => [item.jellyfinId, item]))
    const orderedItems = llmResult.itemIds
      .map((id: string) => itemsMap.get(id))
      .filter(Boolean)

    return NextResponse.json({
      items: orderedItems,
      interpretation: llmResult.interpretation,
      suggestions: llmResult.suggestions,
    })
  } catch (error) {
    console.error('AI Concierge error:', error)
    return NextResponse.json(
      { error: 'Failed to process concierge request' },
      { status: 500 }
    )
  }
}
