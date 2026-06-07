import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// --- Types ---

interface JellyfinItemDetail {
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
  People?: {
    Id: string
    Name: string
    Type: string
    Role?: string
    PrimaryImageTag?: string
  }[]
  ImageTags?: { Primary?: string }
  MediaSources?: { Id: string }[]
  ParentId?: string
}

interface CompanionRequest {
  query: string
  itemId: string
  currentTime?: number
  spoilerProtection?: boolean
}

// --- Extract cast info ---

function extractCastInfo(people: JellyfinItemDetail['People'] | undefined) {
  if (!people || people.length === 0) {
    return { actors: [], directors: [], writers: [] }
  }

  const actors = people
    .filter((p) => p.Type === 'Actor')
    .slice(0, 10)
    .map((p) => ({ name: p.Name, role: p.Role || '' }))

  const directors = people
    .filter((p) => p.Type === 'Director')
    .map((p) => p.Name)

  const writers = people
    .filter((p) => p.Type === 'Writer' || p.Type === 'Screenwriter')
    .map((p) => p.Name)

  return { actors, directors, writers }
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: CompanionRequest = await request.json()
    const { query, itemId, currentTime, spoilerProtection } = body

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    if (!itemId?.trim()) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    const enableSpoilerProtection = spoilerProtection !== false // default true

    // 1. Get Jellyfin credentials
    const server = await db.jellyfinServer.findFirst()
    if (!server || !server.connected) {
      return NextResponse.json(
        { error: 'Not connected to Jellyfin' },
        { status: 400 }
      )
    }

    // 2. Fetch item details from Jellyfin
    let itemDetail: JellyfinItemDetail | null = null
    try {
      const detailUrl = `${server.serverUrl}/Users/${server.userId}/Items/${itemId}?Fields=Overview,People,Genres,Studios,ProductionYear,CommunityRating,OfficialRating`

      const detailController = new AbortController()
      const detailTimeout = setTimeout(() => detailController.abort(), 10000)

      const detailRes = await fetch(detailUrl, {
        headers: { 'X-Emby-Token': server.accessToken },
        signal: detailController.signal,
      })
      clearTimeout(detailTimeout)

      if (detailRes.ok) {
        itemDetail = await detailRes.json()
      }
    } catch {
      // Continue without item details
    }

    if (!itemDetail) {
      return NextResponse.json(
        { error: 'Could not fetch item details from Jellyfin' },
        { status: 404 }
      )
    }

    // 3. Build context from item details
    const { actors, directors, writers } = extractCastInfo(itemDetail.People)

    const context = {
      title: itemDetail.Name || 'Unknown',
      type: itemDetail.Type,
      overview: itemDetail.Overview || '',
      year: itemDetail.ProductionYear,
      genres: itemDetail.Genres || [],
      studios: itemDetail.Studios?.map((s) => s.Name) || [],
      rating: itemDetail.CommunityRating,
      officialRating: itemDetail.OfficialRating,
      actors,
      directors,
      writers,
      runtime: itemDetail.RunTimeTicks
        ? Math.round(itemDetail.RunTimeTicks / 600000000)
        : null,
    }

    // 4. Call LLM for context-aware companion answer
    let result: {
      answer: string
      relatedInfo?: string
      spoilerWarning?: boolean
    }

    try {
      const zai = await ZAI.create()

      const spoilerNote = enableSpoilerProtection
        ? `The viewer is currently at ${currentTime ? `${Math.floor(currentTime / 60)}m ${Math.floor(currentTime % 60)}s into the content` : 'an unknown point in the content'}. IMPORTANT: Do NOT reveal any plot points, twists, or events that happen AFTER the current playback position. If the user asks about something that would be a spoiler, give a vague hint and add "spoilerWarning": true in your response.`
        : 'Spoiler protection is disabled. You may discuss the full plot including endings.'

      const systemPrompt = `You are an AI movie and TV show companion. The user is currently watching something and has a question about it. You have the full context of what they are watching.

${spoilerNote}

You can:
- Answer questions about the cast, director, writers, and their other works
- Provide trivia and behind-the-scenes information
- Explain plot points (respecting spoiler protection)
- Discuss themes, genres, and connections to other media
- Share interesting facts about the production

You have the following context about what the user is watching:
- Title: ${context.title}
- Type: ${context.type}
- Overview: ${context.overview}
- Year: ${context.year || 'Unknown'}
- Genres: ${context.genres.join(', ') || 'Unknown'}
- Studios: ${context.studios.join(', ') || 'Unknown'}
- Rating: ${context.rating || 'Unrated'}${context.officialRating ? ` (${context.officialRating})` : ''}
- Runtime: ${context.runtime ? `${context.runtime} minutes` : 'Unknown'}
- Actors: ${actors.map((a) => (a.role ? `${a.name} (${a.role})` : a.name)).join(', ') || 'Unknown'}
- Directors: ${directors.join(', ') || 'Unknown'}
- Writers: ${writers.join(', ') || 'Unknown'}

Return a JSON object with:
- "answer": your response to the user's question (can be conversational and informative)
- "relatedInfo": optional related information or follow-up suggestion (short, 1-2 sentences)
- "spoilerWarning": true only if you had to withhold spoiler information, omit otherwise

IMPORTANT: Return ONLY valid JSON, no markdown or extra text.`

      const userPrompt = `User question: "${query}"`

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

      result = JSON.parse(jsonStr)

      // Validate structure
      if (typeof result.answer !== 'string') result.answer = ''
      if (result.relatedInfo !== undefined && typeof result.relatedInfo !== 'string') {
        result.relatedInfo = undefined
      }
      if (result.spoilerWarning !== undefined && typeof result.spoilerWarning !== 'boolean') {
        result.spoilerWarning = undefined
      }
    } catch (llmError) {
      console.error('LLM companion error, generating fallback answer:', llmError)

      // Fallback: provide a basic answer from the context data
      const queryLower = query.toLowerCase()
      let answer = ''

      if (/who.*actor|cast|starring|who play/i.test(queryLower)) {
        if (actors.length > 0) {
          answer = `The cast of ${context.title} includes: ${actors.map((a) => (a.role ? `${a.name} as ${a.role}` : a.name)).join(', ')}.`
        } else {
          answer = `I don't have detailed cast information for ${context.title}.`
        }
      } else if (/who.*direct|director/i.test(queryLower)) {
        if (directors.length > 0) {
          answer = `${context.title} was directed by ${directors.join(', ')}.`
        } else {
          answer = `I don't have director information for ${context.title}.`
        }
      } else if (/what.*about|overview|synopsis|plot/i.test(queryLower)) {
        answer = context.overview
          ? `${context.title} (${context.year || 'Unknown year'}): ${context.overview.slice(0, 500)}`
          : `I don't have a synopsis available for ${context.title}.`
      } else if (/genre|type|category/i.test(queryLower)) {
        answer = context.genres.length > 0
          ? `${context.title} is categorized as: ${context.genres.join(', ')}.`
          : `I don't have genre information for ${context.title}.`
      } else if (/rating|score|review/i.test(queryLower)) {
        answer = context.rating
          ? `${context.title} has a community rating of ${context.rating}/10${context.officialRating ? ` and is rated ${context.officialRating}` : ''}.`
          : `I don't have rating information for ${context.title}.`
      } else {
        answer = `I can tell you that ${context.title} (${context.year || 'Unknown year'}) is a ${context.genres.join('/')} ${context.type}. ${actors.length > 0 ? `It stars ${actors.slice(0, 3).map((a) => a.name).join(', ')}.` : ''} ${directors.length > 0 ? `Directed by ${directors.join(', ')}.` : ''} Could you be more specific about what you'd like to know?`
      }

      result = { answer }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI Companion error:', error)
    return NextResponse.json(
      { error: 'Failed to process companion request' },
      { status: 500 }
    )
  }
}
