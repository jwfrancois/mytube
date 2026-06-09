import { NextRequest, NextResponse } from 'next/server'

// Cache recommendations for 30 minutes
const recsCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 1800000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')
    const type = searchParams.get('type') || 'movie'

    if (!title) {
      return NextResponse.json({ recommendations: [] })
    }

    // Check cache
    const cacheKey = `${title}-${type}`
    const cached = recsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    // Use z-ai-web-dev-sdk for web search recommendations
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const typeLabel = type === 'TV_SHOW' ? 'TV show' : type === 'MUSIC' ? 'music album' : type.toLowerCase()
    const query = `movies like ${title} recommendations similar ${typeLabel}s`

    const results = await zai.functions.invoke('web_search', {
      query,
      num: 8,
    })

    // Format recommendations from web search results
    const recommendations = (results || []).map((item: any, idx: number) => ({
      id: `rec-${idx}-${encodeURIComponent(item.name)}`,
      title: item.name || 'Recommendation',
      description: item.snippet || '',
      type,
      genre: '',
      thumbnail: '',
      videoUrl: '',
      duration: '',
      releaseYear: 0,
      artist: '',
      views: 0,
      channel: item.host_name || '',
      isJellyfin: false,
      isRecommendation: true,
      url: item.url || '',
      source: item.host_name || 'web',
    }))

    const result = { recommendations }
    recsCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ recommendations: [] })
  }
}
