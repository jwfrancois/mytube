import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

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

    // Use OpenAI for recommendations
    const typeLabel = type === 'TV_SHOW' ? 'TV show' : type === 'MUSIC' ? 'music album' : type.toLowerCase()

    const completion = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a media recommendation engine. Given a title and type, suggest similar media the user might enjoy. Return ONLY valid JSON with no markdown. The JSON should be an object with a "recommendations" array, where each item has: title (string), description (1-2 sentence description), reason (why it is similar).',
        },
        {
          role: 'user',
          content: `Suggest 8 media titles similar to "${title}" (${typeLabel}). Include a mix of well-known and lesser-known recommendations. Return JSON with "recommendations" array containing objects with title, description, and reason fields.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content || ''
    let jsonStr = content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1].trim()

    const parsed = JSON.parse(jsonStr)
    const recsList = Array.isArray(parsed) ? parsed : (parsed.recommendations || [])

    const recommendations = recsList.slice(0, 8).map((item: any, idx: number) => ({
      id: `rec-${idx}-${encodeURIComponent(item.title || 'item')}`,
      title: item.title || 'Recommendation',
      description: item.description || item.reason || '',
      type,
      genre: '',
      thumbnail: '',
      videoUrl: '',
      duration: '',
      releaseYear: 0,
      artist: '',
      views: 0,
      channel: '',
      isJellyfin: false,
      isRecommendation: true,
      url: '',
      source: 'AI',
    }))

    const result = { recommendations }
    recsCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ recommendations: [] })
  }
}
