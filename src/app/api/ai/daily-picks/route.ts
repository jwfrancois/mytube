import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai'

// --- Types ---

interface HistoryItem {
  title: string
  type: string
  genre: string
}

interface MediaItemInput {
  id: string
  title: string
  type: string
  genre: string
  description: string
  thumbnail: string
  videoUrl: string
  releaseYear: number
  artist: string
  views: number
  channel: string
  createdAt: string
}

interface DailyPick {
  category: string
  reason: string
  itemId: string
}

interface DailyPicksRequest {
  history: HistoryItem[]
  mediaItems: MediaItemInput[]
}

// --- Fallback: rule-based picks when LLM is unavailable ---

function generateFallbackPicks(mediaItems: MediaItemInput[]): DailyPick[] {
  if (mediaItems.length === 0) return []

  const picks: DailyPick[] = []
  const shuffled = [...mediaItems].sort(() => Math.random() - 0.5)

  // Today's Pick — highest views or most recent
  const todaysPick = mediaItems.reduce((best, item) =>
    (item.views || 0) > (best.views || 0) ? item : best
  , mediaItems[0])
  picks.push({
    category: "Today's Pick",
    reason: 'A top pick from your library based on popularity.',
    itemId: todaysPick.id,
  })

  // Hidden Gem — lower views but good content
  const hiddenGem = shuffled.find(i => (i.views || 0) < 500 && i.id !== todaysPick.id)
    || shuffled.find(i => i.id !== todaysPick.id)
    || shuffled[0]
  picks.push({
    category: 'Hidden Gem',
    reason: 'A lesser-known title you might have overlooked.',
    itemId: hiddenGem.id,
  })

  // Mood Match — pick something different
  const moodMatch = shuffled.find(i =>
    i.id !== todaysPick.id && i.id !== hiddenGem.id
  ) || shuffled[0]
  picks.push({
    category: 'Mood Match',
    reason: 'Something that fits the vibe for today.',
    itemId: moodMatch.id,
  })

  // Weekend Binge — a series or longer content
  const binge = shuffled.find(i =>
    (i.type === 'TV_SHOW' || i.type === 'PODCAST') &&
    i.id !== todaysPick.id && i.id !== hiddenGem.id && i.id !== moodMatch.id
  ) || shuffled.find(i => i.id !== todaysPick.id && i.id !== hiddenGem.id && i.id !== moodMatch.id)
    || shuffled[0]
  picks.push({
    category: 'Weekend Binge',
    reason: 'Perfect for a longer viewing session.',
    itemId: binge.id,
  })

  return picks
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    const body: DailyPicksRequest = await request.json()
    const { history, mediaItems } = body

    if (!mediaItems || mediaItems.length === 0) {
      return NextResponse.json(
        { error: 'No media items provided' },
        { status: 400 }
      )
    }

    // Build a condensed catalog for the LLM
    const catalog = mediaItems.slice(0, 150).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      genre: item.genre,
      year: item.releaseYear || null,
      desc: (item.description || '').slice(0, 80),
      artist: item.artist || '',
      views: item.views || 0,
    }))

    // Build history summary
    const historySummary = history && history.length > 0
      ? history.slice(0, 20).map(h => `"${h.title}" (${h.type}, ${h.genre})`).join(', ')
      : 'No watch history available'

    // Call LLM for daily picks
    let picks: DailyPick[]

    try {
      const systemPrompt = `You are an intelligent daily media curator for a personal streaming app called MyTube. Given a user's watch history and available media, generate personalized daily picks.

You must pick 3-5 items the user would enjoy based on their history and the available catalog. Assign each pick to one of these categories:
- "Today's Pick" — The single best recommendation for today (only ONE item gets this)
- "Hidden Gem" — A lesser-known or underrated title the user might have overlooked
- "Mood Match" — Something that matches the user's mood or viewing pattern
- "Weekend Binge" — A series, podcast, or longer content perfect for extended viewing

For each pick, provide:
- "category": one of the four categories above
- "reason": a brief, personalized explanation (1-2 sentences) for why this is recommended
- "itemId": the exact ID from the catalog

Guidelines:
- Prioritize variety — don't pick all the same type or genre
- Consider the user's history for personalization
- If no watch history exists, pick popular or highly-rated items across different categories
- "Today's Pick" should be the most compelling recommendation
- "Hidden Gem" should be something with lower view counts but high quality
- "Mood Match" should reflect viewing patterns or complementary content
- "Weekend Binge" should be binge-worthy (series, podcasts, or long-form content if available)

Return a JSON object with:
- "picks": array of objects, each with "category", "reason", and "itemId"

IMPORTANT: Return ONLY valid JSON, no markdown or extra text.`

      const userPrompt = `User's watch history: ${historySummary}

Available media catalog (${catalog.length} items):
${JSON.stringify(catalog)}`

      // Set a 25s timeout for LLM call
      const llmPromise = chatCompletion({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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

      const parsed = JSON.parse(jsonStr)

      if (!Array.isArray(parsed.picks)) {
        throw new Error('Invalid LLM response structure')
      }

      // Validate and filter picks
      const validIds = new Set(mediaItems.map((i) => i.id))
      picks = parsed.picks
        .filter((pick: Record<string, unknown>) =>
          typeof pick.category === 'string' &&
          typeof pick.reason === 'string' &&
          typeof pick.itemId === 'string' &&
          validIds.has(pick.itemId as string)
        )
        .map((pick: { category: string; reason: string; itemId: string }) => ({
          category: pick.category,
          reason: pick.reason,
          itemId: pick.itemId,
        }))

      // Ensure we have at least one "Today's Pick"
      const hasTodaysPick = picks.some(p => p.category === "Today's Pick")
      if (!hasTodaysPick && picks.length > 0) {
        picks[0].category = "Today's Pick"
      }

      // Limit to 5 picks max
      picks = picks.slice(0, 5)
    } catch (llmError) {
      console.error('LLM daily picks error, falling back to rule-based:', llmError)
      picks = generateFallbackPicks(mediaItems)
    }

    // Match picks to full media items
    const itemMap = new Map(mediaItems.map((item) => [item.id, item]))
    const enrichedPicks = picks
      .map((pick) => {
        const item = itemMap.get(pick.itemId)
        if (!item) return null
        return {
          category: pick.category,
          reason: pick.reason,
          item,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ picks: enrichedPicks })
  } catch (error) {
    console.error('Daily AI Picks error:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily picks' },
      { status: 500 }
    )
  }
}
