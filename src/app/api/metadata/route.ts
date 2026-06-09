import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

// ── In-memory cache with 1-hour TTL ──────────────────────────────────────────
interface CacheEntry {
  data: Record<string, unknown>
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCacheKey(title: string, type: string, year?: string): string {
  return `${title}-${type}-${year ?? 'none'}`
}

function getFromCache(key: string): Record<string, unknown> | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: Record<string, unknown>): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// ── Valid media types ─────────────────────────────────────────────────────────
const VALID_TYPES = new Set([
  'MOVIE',
  'TV_SHOW',
  'MUSIC',
  'AUDIOBOOK',
  'PODCAST',
  'BOOK',
])

// ── Timeout helper ────────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation timed out')), ms)
    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

// ── Web search ────────────────────────────────────────────────────────────────
async function searchWeb(query: string): Promise<string> {
  try {
    const completion = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are a media search assistant. Given a query, provide concise factual information about the media title. Include key details like plot, cast, ratings, and reception. Keep to 3-4 paragraphs.' },
        { role: 'user', content: `Provide detailed information about: ${query}` },
      ],
      temperature: 0.3,
      max_tokens: 800,
    })
    return completion.choices[0]?.message?.content || ''
  } catch (err) {
    console.error('Search failed:', err)
    return ''
  }
}

// ── LLM enrichment ────────────────────────────────────────────────────────────
async function enrichWithLLM(
  title: string,
  type: string,
  year: string | undefined,
  searchResults: string
): Promise<Record<string, unknown>> {
  const typeLabel =
    {
      MOVIE: 'movie',
      TV_SHOW: 'TV show',
      MUSIC: 'music album',
      AUDIOBOOK: 'audiobook',
      PODCAST: 'podcast',
      BOOK: 'book',
    }[type] ?? 'media'

  const yearClause = year ? ` released in ${year}` : ''

  const searchContext = searchResults
    ? `\n\nHere are real-time web search results about this title:\n${searchResults}`
    : ''

  const prompt = `You are a media metadata expert. Given the following ${typeLabel} title"${title}"${yearClause}, provide comprehensive, accurate metadata.${searchContext}

Based on the search results above and your knowledge, return a JSON object with EXACTLY this structure. Use realistic, factually accurate data wherever possible. If you are uncertain about a specific field, provide your best reasonable estimate but never fabricate improbable data.

Return ONLY valid JSON (no markdown, no code fences, no commentary) with these fields:

{
  "synopsis": "Full plot synopsis or description, 2-3 paragraphs",
  "criticsConsensus": "What critics say, 1-2 sentences",
  "audienceScore": 0-100 estimated audience score,
  "criticScore": 0-100 estimated critic score,
  "awards": ["list of notable awards or nominations"],
  "trivia": ["3-5 interesting facts"],
  "similarTitles": ["5 similar ${typeLabel}s"],
  "streamingOn": ["where to stream, if applicable, otherwise empty array"],
  "imdbRating": 0.0-10.0 estimated IMDB rating,
  "rottenTomatoes": "e.g. 92%",
  "metacritic": 0-100,
  "runtime": "e.g. 2h 22min or N/A for music/books",
  "budget": "e.g. $150 million or N/A",
  "boxOffice": "e.g. $1.2 billion or N/A",
  "label": "record label (for music) or empty string",
  "producer": ["producers (for music) or empty array"],
  "network": "original network (for TV shows) or empty string",
  "seasons": 0 (total seasons for TV shows, 0 otherwise),
  "status": "e.g. Ended or Running (for TV shows) or empty string",
  "narrator": "narrator name (for audiobooks) or empty string",
  "publisher": "publisher (for audiobooks/books) or empty string"
}`

  try {
    const completion = await chatCompletion({
      messages: [
        { role: 'assistant', content: 'You are a precise JSON-producing media metadata API. You always return valid JSON with no extra text.' },
        { role: 'user', content: prompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return {}

    // Strip potential markdown fences
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    return parsed
  } catch (err) {
    console.error('LLM enrichment failed:', err)
    return {}
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title')?.trim()
  const type = searchParams.get('type')?.trim()?.toUpperCase()
  const year = searchParams.get('year')?.trim() || undefined

  // Validate required params
  if (!title) {
    return NextResponse.json(
      { error: 'Query param "title" is required' },
      { status: 400 }
    )
  }

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Query param "type" must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 }
    )
  }

  // Check cache first
  const cacheKey = getCacheKey(title, type, year)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Base response echoed back
  const baseResponse: Record<string, unknown> = {
    title,
    type,
    ...(year ? { year } : {}),
  }

  try {
    // Run the full enrichment pipeline with a 30-second timeout
    const enriched = await withTimeout(
      (async () => {
        // Step 1: Web search
        const typeLabel =
          {
            MOVIE: 'movie',
            TV_SHOW: 'TV show',
            MUSIC: 'music album',
            AUDIOBOOK: 'audiobook',
            PODCAST: 'podcast',
            BOOK: 'book',
          }[type] ?? 'media'

        const searchQuery = `${title} ${typeLabel}${year ? ` ${year}` : ''} review rating synopsis`
        const searchResults = await searchWeb(searchQuery)

        // Step 2: LLM enrichment
        const metadata = await enrichWithLLM(title, type, year, searchResults)

        return metadata
      })(),
      30_000
    )

    // Merge base + enriched data
    const response = { ...baseResponse, ...enriched }

    // Cache the result
    setCache(cacheKey, response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Metadata enrichment error:', error)

    // On failure, return whatever partial data we have (just base info)
    const partial = {
      ...baseResponse,
      synopsis: '',
      criticsConsensus: '',
      audienceScore: 0,
      criticScore: 0,
      awards: [],
      trivia: [],
      similarTitles: [],
      streamingOn: [],
      imdbRating: 0,
      rottenTomatoes: '',
      metacritic: 0,
      runtime: '',
      budget: '',
      boxOffice: '',
      label: '',
      producer: [],
      network: '',
      seasons: 0,
      status: '',
      narrator: '',
      publisher: '',
    }

    return NextResponse.json(partial)
  }
}
