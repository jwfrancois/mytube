import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// ── Singleton ZAI instance ────────────────────────────────────────────────────
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// ── In-memory cache with 2-hour TTL ──────────────────────────────────────────
interface CacheEntry {
  summary: string
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function getCacheKey(title: string, type: string, year?: number): string {
  return `summary-${title}-${type}-${year ?? 'none'}`
}

function getFromCache(key: string): string | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.summary
}

function setCache(key: string, summary: string): void {
  cache.set(key, { summary, timestamp: Date.now() })
}

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

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title')?.trim()
  const type = searchParams.get('type')?.trim()?.toUpperCase()
  const year = searchParams.get('year')?.trim()

  if (!title) {
    return NextResponse.json(
      { error: 'Query param "title" is required' },
      { status: 400 }
    )
  }

  const yearNum = year ? parseInt(year, 10) : undefined

  // Check cache first
  const cacheKey = getCacheKey(title, type || 'UNKNOWN', yearNum)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return NextResponse.json({ summary: cached })
  }

  const typeLabel =
    {
      MOVIE: 'movie',
      TV_SHOW: 'TV show',
      MUSIC: 'music album',
      AUDIOBOOK: 'audiobook',
      PODCAST: 'podcast',
      BOOK: 'book',
    }[type || ''] ?? 'media'

  const yearClause = yearNum ? ` from ${yearNum}` : ''

  try {
    const zai = await getZAI()

    const summary = await withTimeout(
      (async () => {
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'You are a media expert that generates extremely concise, engaging one-line teasers for media content. You always respond with just the teaser text, no quotes, no labels, no prefixes.',
            },
            {
              role: 'user',
              content: `Write a single compelling one-line teaser (max 120 characters) for the ${typeLabel} "${title}"${yearClause}. Make it catchy and intriguing, like a streaming platform tagline. Do NOT use quotes around your response.`,
            },
          ],
          thinking: { type: 'disabled' },
        })

        return completion.choices[0]?.message?.content?.trim() ?? ''
      })(),
      15_000
    )

    // Cache the result
    setCache(cacheKey, summary)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('AI Summary generation error:', error)

    // Return a fallback summary
    const fallback = `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} — ${title}${yearClause}`
    return NextResponse.json({ summary: fallback })
  }
}
