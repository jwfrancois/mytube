import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// --- Types ---

interface NewsItem {
  title: string
  snippet: string
  url: string
  source: string
  date: string
  category: string
}

interface CacheEntry {
  items: NewsItem[]
  timestamp: number
}

// --- In-memory cache (30 min TTL) ---

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const cache = new Map<string, CacheEntry>()

function getCacheKey(category: string): string {
  return `entertainment-${category}`
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_TTL
}

// --- Category search queries ---

const CATEGORY_QUERIES: Record<string, string> = {
  movies:
    'trending movies news today box office results new movie releases 2025',
  tv:
    'trending TV shows news today new series releases streaming 2025',
  music:
    'trending music news today new album releases charts 2025',
  gaming:
    'trending gaming news today new game releases video game updates 2025',
}

const VALID_CATEGORIES = ['movies', 'tv', 'music', 'gaming']

// --- GET handler ---

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category') || 'movies'

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = getCacheKey(category)
    const cached = cache.get(cacheKey)
    if (isCacheValid(cached)) {
      return NextResponse.json({ items: cached!.items, cached: true })
    }

    // Search using z-ai-web-dev-sdk
    const query = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.movies
    let items: NewsItem[] = []

    try {
      const zai = await ZAI.create()
      const results = await zai.functions.invoke('web_search', {
        query,
        num: 10,
      })

      // Parse web search results into structured NewsItems
      if (Array.isArray(results)) {
        items = results.map((result: any, idx: number) => ({
          title: result.title || result.name || `Trending ${category} story ${idx + 1}`,
          snippet: result.snippet || result.content || result.description || '',
          url: result.url || result.link || '#',
          source: result.source || result.site || 'Web',
          date: result.date || result.published || new Date().toISOString().split('T')[0],
          category,
        }))
      } else if (results && typeof results === 'object') {
        // Handle object response (some SDK versions return { results: [...] })
        const resultList = results.results || results.items || results.data || []
        if (Array.isArray(resultList)) {
          items = resultList.map((result: any, idx: number) => ({
            title: result.title || result.name || `Trending ${category} story ${idx + 1}`,
            snippet: result.snippet || result.content || result.description || '',
            url: result.url || result.link || '#',
            source: result.source || result.site || 'Web',
            date: result.date || result.published || new Date().toISOString().split('T')[0],
            category,
          }))
        }
      }
    } catch (searchError) {
      console.error('Web search error for entertainment:', searchError)
      // Return empty results rather than failing entirely
    }

    // Update cache
    cache.set(cacheKey, { items, timestamp: Date.now() })

    return NextResponse.json({ items, cached: false })
  } catch (error) {
    console.error('Entertainment API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entertainment news' },
      { status: 500 }
    )
  }
}
