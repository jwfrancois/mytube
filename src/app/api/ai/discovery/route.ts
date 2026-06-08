import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
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

interface DiscoveryRequest {
  query: string
  discoveryType: 'semantic' | 'mood' | 'thematic'
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
): { itemIds: string[]; interpretation: string; themes: string[]; suggestions: string[] } {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)

  if (terms.length === 0) {
    return {
      itemIds: [],
      interpretation: 'Query too short for keyword matching',
      themes: [],
      suggestions: ['Try a more descriptive search'],
    }
  }

  const scored = items
    .map((item) => {
      const peopleNames = (item.People || []).slice(0, 5).map((p) => p.Name).join(' ')
      const text = [
        item.Name,
        item.Overview,
        (item.Genres || []).join(' '),
        item.AlbumArtist,
        (item.Artists || []).join(' '),
        item.OfficialRating,
        String(item.ProductionYear || ''),
        peopleNames,
        (item.Studios || []).map((s) => s.Name).join(' '),
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
    themes: terms.slice(0, 3),
    suggestions: [
      'Try describing the mood or theme you are looking for',
      'Mention a specific genre, era, or concept',
    ],
  }
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: DiscoveryRequest = await request.json()
    const { query, discoveryType } = body

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const type = discoveryType || 'semantic'
    if (!['semantic', 'mood', 'thematic'].includes(type)) {
      return NextResponse.json(
        { error: 'discoveryType must be "semantic", "mood", or "thematic"' },
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

    // 2. Fetch library structure for type mapping
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

    // 3. Fetch ALL items from the library with full metadata
    let rawItems: JellyfinItem[] = []
    try {
      const allUrl = `${creds.serverUrl}/Items?UserId=${creds.userId}&Recursive=true&IncludeItemTypes=Movie,Series,Audio,AudioBook&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People,AlbumArtist,Artists&SortBy=SortName&SortOrder=Ascending&Limit=500`

      const allController = new AbortController()
      const allTimeout = setTimeout(() => allController.abort(), 15000)

      const allRes = await fetch(allUrl, {
        headers: { 'X-Emby-Token': creds.accessToken },
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
        items: [],
        interpretation: 'Could not connect to your media library',
        themes: [],
        suggestions: ['Check your Jellyfin connection', 'Try a simpler search'],
      })
    }

    // 4. Build a richer catalog for the LLM (includes key people)
    const catalog = rawItems.slice(0, 300).map((item) => {
      const people = item.People || []
      const keyActors = people
        .filter((p) => p.Type === 'Actor')
        .slice(0, 3)
        .map((p) => p.Name)
      const keyDirectors = people
        .filter((p) => p.Type === 'Director')
        .slice(0, 2)
        .map((p) => p.Name)

      return {
        id: item.Id,
        name: item.Name,
        type: item.Type,
        genres: (item.Genres || []).slice(0, 4).join(', '),
        year: item.ProductionYear || null,
        rating: item.CommunityRating || null,
        desc: (item.Overview || '').slice(0, 200),
        actors: keyActors,
        director: keyDirectors,
        artist: item.AlbumArtist || (item.Artists || []).slice(0, 2).join(', '),
        officialRating: item.OfficialRating || null,
      }
    })

    // 5. Call LLM for semantic discovery
    let llmResult: {
      itemIds: string[]
      interpretation: string
      themes: string[]
      suggestions: string[]
    }

    try {
      const zai = await ZAI.create()

      const discoveryPrompt =
        type === 'semantic'
          ? `Perform a SEMANTIC search. Understand the CONCEPT behind the user's query, not just keywords. For example, "humanity overcoming impossible odds" could match sci-fi survival, sports underdogs, war dramas, etc. Look beyond genre labels to find thematic resonance.`
          : type === 'mood'
            ? `Perform a MOOD-BASED search. Find items that evoke the emotional quality described. Consider tone, atmosphere, pacing, and the emotional journey of the content.`
            : `Perform a THEMATIC search. Find items that share the same underlying themes, motifs, or narrative patterns, even across different genres or eras.`

      const systemPrompt = `You are an intelligent semantic discovery engine for a personal media library. You understand concepts, moods, themes, and narrative patterns — not just keywords.

${discoveryPrompt}

Given a user's natural language request and a catalog of available media, find the best conceptual matches.

Return a JSON object with:
- "itemIds": array of item IDs that match the request conceptually (max 12)
- "interpretation": brief description of what themes/moods/concepts you understood from the query
- "themes": array of theme strings that were matched (e.g., "survival", "redemption", "found family")
- "suggestions": array of 2-3 alternative search ideas the user might enjoy

Think deeply about WHAT the user is really looking for, not just surface-level keyword matches. A query about "overcoming impossible odds" might match movies about space survival, sports underdogs, war dramas, or even music about perseverance.

Only include items from the catalog that genuinely match. If no items match well, return an empty itemIds array and explain why.

IMPORTANT: Return ONLY valid JSON, no markdown or extra text.`

      const userPrompt = `User request: "${query}"

Available catalog (${catalog.length} items):
${JSON.stringify(catalog)}`

      // Set a 25s timeout for LLM call (semantic search may need more time)
      const llmPromise = zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })

      const llmTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 25000)
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
      if (typeof llmResult.interpretation !== 'string') llmResult.interpretation = ''
      if (!Array.isArray(llmResult.themes)) llmResult.themes = []
      if (!Array.isArray(llmResult.suggestions)) llmResult.suggestions = []

      // Filter to only valid IDs
      const validIds = new Set(rawItems.map((i) => i.Id))
      llmResult.itemIds = llmResult.itemIds.filter((id: string) => validIds.has(id))
    } catch (llmError) {
      console.error('LLM discovery error, falling back to keyword search:', llmError)
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
      themes: llmResult.themes,
      suggestions: llmResult.suggestions,
    })
  } catch (error) {
    console.error('AI Discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to process discovery request' },
      { status: 500 }
    )
  }
}
