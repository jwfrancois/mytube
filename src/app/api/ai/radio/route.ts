import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

// --- Types ---

interface JellyfinAudioItem {
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

interface RadioRequest {
  type: 'mood' | 'genre' | 'personalized'
  mood: string
  genre: string
  description: string
}

// --- Mapping ---

function mapAudioItem(item: JellyfinAudioItem) {
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
    type: 'MUSIC',
    genre: (item.Genres || []).join(', '),
    thumbnail: item.ImageTags?.Primary
      ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : '',
    videoUrl: '',
    duration,
    releaseYear: item.ProductionYear || 0,
    artist: item.AlbumArtist || (item.Artists || []).join(', ') || '',
    views: 0,
    channel: item.OfficialRating || '',
    isJellyfin: true,
    jellyfinId: item.Id,
    mediaSourceId: item.MediaSources?.[0]?.Id || '',
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren: false,
    childCount: 0,
    communityRating: item.CommunityRating,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
  }
}

// --- Keyword fallback for radio ---

function keywordRadioFallback(
  items: JellyfinAudioItem[],
  body: RadioRequest
): { trackIds: string[]; stationName: string; description: string } {
  const type = body.type
  const searchTerms =
    type === 'mood'
      ? body.mood.toLowerCase().split(/\s+/)
      : type === 'genre'
        ? body.genre.toLowerCase().split(/\s+/)
        : (body.description || '').toLowerCase().split(/\s+/)

  const terms = searchTerms.filter((t) => t.length > 2)

  if (terms.length === 0) {
    return {
      trackIds: items.slice(0, 20).map((i) => i.Id),
      stationName: 'Random Mix Radio',
      description: 'A random selection from your library',
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
    .slice(0, 20)

  const label =
    type === 'mood'
      ? body.mood
      : type === 'genre'
        ? body.genre
        : 'Custom'

  return {
    trackIds: scored.map((s) => s.id),
    stationName: `${label} Radio`,
    description: `Tracks matching "${label}" from your library`,
  }
}

// --- Build prompt based on station type ---

function buildPrompt(body: RadioRequest): string {
  const type = body.type

  if (type === 'mood') {
    return `Create a radio station for the mood: "${body.mood}"

Select tracks that evoke this mood. Consider tempo, instrumentation, and overall feel. Mix genres if it fits the mood.`
  }

  if (type === 'genre') {
    return `Create a radio station that fuses these genres: "${body.genre}"

Find tracks that represent each genre and blend them into a cohesive listening experience. Transition smoothly between genres.`
  }

  // personalized
  return `Create a personalized radio station based on this description: "${body.description}"

Use the description to select the most appropriate tracks. Consider variety, flow, and the listener's intent.`
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: RadioRequest = await request.json()
    const { type, mood, genre, description } = body

    if (!type || !['mood', 'genre', 'personalized'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "mood", "genre", or "personalized"' },
        { status: 400 }
      )
    }

    if (type === 'mood' && !mood) {
      return NextResponse.json(
        { error: 'Mood is required for mood type stations' },
        { status: 400 }
      )
    }
    if (type === 'genre' && !genre) {
      return NextResponse.json(
        { error: 'Genre is required for genre type stations' },
        { status: 400 }
      )
    }
    if (type === 'personalized' && !description) {
      return NextResponse.json(
        { error: 'Description is required for personalized stations' },
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

    // 2. Fetch audio tracks from the library (try search first, then all)
    let rawTracks: JellyfinAudioItem[] = []
    const searchQuery = type === 'mood' ? mood : type === 'genre' ? genre : description || ''

    // First try: Jellyfin built-in search (fast)
    try {
      const searchUrl = `${creds.serverUrl}/Items?UserId=${creds.userId}&SearchTerm=${encodeURIComponent(searchQuery)}&Recursive=true&IncludeItemTypes=Audio&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,ChildCount,AlbumArtist,Artists&SortBy=SortName&SortOrder=Ascending&Limit=200`

      const searchController = new AbortController()
      const searchTimeout = setTimeout(() => searchController.abort(), 10000)

      const searchRes = await fetch(searchUrl, {
        headers: { 'X-Emby-Token': creds.accessToken },
        signal: searchController.signal,
      })
      clearTimeout(searchTimeout)

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        rawTracks = searchData.Items || []
      }
    } catch {
      // Search failed, try fetching all
    }

    // If search returned too few, also fetch popular audio
    if (rawTracks.length < 20) {
      try {
        const allUrl = `${creds.serverUrl}/Items?UserId=${creds.userId}&Recursive=true&IncludeItemTypes=Audio&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,ChildCount,AlbumArtist,Artists&SortBy=CommunityRating&SortOrder=Descending&Limit=300`

        const allController = new AbortController()
        const allTimeout = setTimeout(() => allController.abort(), 10000)

        const allRes = await fetch(allUrl, {
          headers: { 'X-Emby-Token': creds.accessToken },
          signal: allController.signal,
        })
        clearTimeout(allTimeout)

        if (allRes.ok) {
          const allData = await allRes.json()
          const allTracks: JellyfinAudioItem[] = allData.Items || []
          const existingIds = new Set(rawTracks.map((t) => t.Id))
          for (const track of allTracks) {
            if (!existingIds.has(track.Id)) {
              rawTracks.push(track)
            }
          }
        }
      } catch {
        // Continue with whatever we have
      }
    }

    if (rawTracks.length === 0) {
      return NextResponse.json({
        tracks: [],
        stationName: 'Empty Library Radio',
        description: 'No audio tracks found in your library',
      })
    }

    // 3. Build condensed catalog for the LLM (keep small for speed)
    const catalog = rawTracks.slice(0, 200).map((track) => ({
      id: track.Id,
      name: track.Name,
      genres: (track.Genres || []).slice(0, 3).join(', '),
      artist: track.AlbumArtist || (track.Artists || []).slice(0, 2).join(', '),
      year: track.ProductionYear || null,
    }))

    // 4. Call LLM
    let llmResult: {
      trackIds: string[]
      stationName: string
      description: string
    }

    try {
      const systemPrompt = `You are a DJ and music curator for a personal music library. Given a radio station concept and a catalog of available tracks, create the perfect playlist.

For mood stations: Select tracks that evoke the specified mood. Consider tempo, genre, and overall feel.
For genre fusion: Find tracks that blend or bridge the specified genres.
For personalized: Use the description to select tracks.

Return a JSON object with:
- "trackIds": array of track IDs for the playlist (15-25 tracks)
- "stationName": creative name for this radio station (short, catchy)
- "description": brief description of the station's vibe (1-2 sentences)

IMPORTANT: Return ONLY valid JSON, no markdown or extra text. Only use track IDs from the provided catalog.`

      const userPrompt = `${buildPrompt(body)}

Available tracks (${catalog.length} tracks):
${JSON.stringify(catalog)}`

      // Set a 20s timeout for LLM call
      const llmPromise = chatCompletion({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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
      if (!Array.isArray(llmResult.trackIds)) llmResult.trackIds = []
      if (typeof llmResult.stationName !== 'string') llmResult.stationName = 'Custom Radio'
      if (typeof llmResult.description !== 'string')
        llmResult.description = 'A curated playlist from your library'

      // Filter to only valid IDs
      const validIds = new Set(rawTracks.map((t) => t.Id))
      llmResult.trackIds = llmResult.trackIds.filter(
        (id: string) => validIds.has(id)
      )
    } catch (llmError) {
      console.error('LLM radio error, falling back to keyword search:', llmError)
      llmResult = keywordRadioFallback(rawTracks, body)
    }

    // 5. Map matching tracks to MediaItem format
    const matchedTracks = rawTracks
      .filter((track) => llmResult.trackIds.includes(track.Id))
      .map((track) => mapAudioItem(track))

    // Preserve LLM ordering
    const tracksMap = new Map(
      matchedTracks.map((track) => [track.jellyfinId, track])
    )
    const orderedTracks = llmResult.trackIds
      .map((id: string) => tracksMap.get(id))
      .filter(Boolean)

    return NextResponse.json({
      tracks: orderedTracks,
      stationName: llmResult.stationName,
      description: llmResult.description,
    })
  } catch (error) {
    console.error('AI Radio error:', error)
    return NextResponse.json(
      { error: 'Failed to process radio request' },
      { status: 500 }
    )
  }
}
