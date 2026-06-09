import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

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

// --- Valid categories ---

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

    // Generate trending entertainment news using OpenAI
    let items: NewsItem[] = []

    try {
      const categoryLabels: Record<string, string> = {
        movies: 'movies and film',
        tv: 'TV shows and streaming',
        music: 'music and albums',
        gaming: 'video games and gaming',
      }

      const completion = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a trending entertainment news aggregator. Generate realistic, current trending news items. Return ONLY valid JSON with no markdown. The JSON should be an object with an "items" array, where each item has: title (string), snippet (2-3 sentence summary), url (realistic URL or #), source (news source name), date (YYYY-MM-DD format). Base items on real current trends if possible, or realistic projections.',
          },
          {
            role: 'user',
            content: `Generate 8-10 trending ${categoryLabels[category] || category} news stories for today (${new Date().toISOString().split('T')[0]}). Include a mix of breaking news, releases, announcements, and industry updates. Return JSON with "items" array.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      })

      const content = completion.choices[0]?.message?.content || ''
      let jsonStr = content.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1].trim()

      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed.items)) {
        items = parsed.items.map((result: any, idx: number) => ({
          title: result.title || `Trending ${category} story ${idx + 1}`,
          snippet: result.snippet || '',
          url: result.url || '#',
          source: result.source || 'Web',
          date: result.date || new Date().toISOString().split('T')[0],
          category,
        }))
      } else if (Array.isArray(parsed)) {
        items = parsed.map((result: any, idx: number) => ({
          title: result.title || `Trending ${category} story ${idx + 1}`,
          snippet: result.snippet || '',
          url: result.url || '#',
          source: result.source || 'Web',
          date: result.date || new Date().toISOString().split('T')[0],
          category,
        }))
      }
    } catch (searchError) {
      console.error('Entertainment news generation error:', searchError)
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
