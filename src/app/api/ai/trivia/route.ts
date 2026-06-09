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

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryItem {
  title: string
  type: string
  genre: string
}

interface TriviaRequest {
  history: HistoryItem[]
  mode: 'facts' | 'quiz'
}

interface FunFact {
  fact: string
  relatedTitle: string
  category: string
}

interface QuizQuestion {
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  relatedTitle: string
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

// ── Parse JSON from LLM response ─────────────────────────────────────────────
function parseLLMJson(content: string): unknown {
  let jsonStr = content.trim()

  // Try extracting from markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  // Try to find the JSON object/array if still not clean
  const objectMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (objectMatch) {
    jsonStr = objectMatch[1].trim()
  }

  return JSON.parse(jsonStr)
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: TriviaRequest = await request.json()
    const { history, mode } = body

    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json(
        { error: 'Watch history is required' },
        { status: 400 }
      )
    }

    if (mode !== 'facts' && mode !== 'quiz') {
      return NextResponse.json(
        { error: 'Mode must be "facts" or "quiz"' },
        { status: 400 }
      )
    }

    // Build the media list description for the prompt
    const mediaList = history
      .slice(0, 20)
      .map((item, i) => `${i + 1}. "${item.title}" (${item.type}, ${item.genre || 'Unknown genre'})`)
      .join('\n')

    let systemPrompt: string
    let userMessage: string

    if (mode === 'facts') {
      systemPrompt = `You are a media trivia expert. Generate 5 fascinating, lesser-known facts about the movies, shows, and music the user has watched. Each fact should be surprising, educational, or entertaining. Focus on behind-the-scenes stories, production secrets, cultural impact, or surprising connections.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "fact": "A fascinating, detailed fact (2-3 sentences)",
      "relatedTitle": "The exact title this fact relates to",
      "category": "One of: Production, Cast, Music, Cultural Impact, Technology, History, Trivia"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text, no code blocks.`

      userMessage = `Here are the movies/shows/music the user has watched:\n\n${mediaList}\n\nGenerate 5 fascinating, lesser-known facts about these titles. Make each fact unique and interesting. Distribute facts across different titles if possible.`
    } else {
      systemPrompt = `You are a media trivia quiz master. Create 5 engaging trivia questions about movies, shows, and music the user has watched. Each question should have 4 options with only one correct answer. Questions should range from easy to challenging. Include a brief explanation for each answer.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "question": "The trivia question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why this is the correct answer (1-2 sentences)",
      "relatedTitle": "The exact title this question relates to"
    }
  ]
}

IMPORTANT:
- correctIndex is 0-based (0 = first option, 1 = second, etc.)
- Return ONLY valid JSON. No markdown, no extra text, no code blocks.
- Make the wrong options plausible (no obvious throwaway answers).`

      userMessage = `Here are the movies/shows/music the user has watched:\n\n${mediaList}\n\nCreate 5 trivia questions about these titles. Mix up difficulty levels and question types (plot, cast, production, awards, etc.). Distribute questions across different titles if possible.`
    }

    // Call LLM
    try {
      const zai = await getZAI()

      const result = await withTimeout(
        (async () => {
          const completion = await zai.chat.completions.create({
            messages: [
              { role: 'assistant', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            thinking: { type: 'disabled' },
          })
          return completion.choices[0]?.message?.content || ''
        })(),
        30_000
      )

      // Parse the JSON response
      const parsed = parseLLMJson(result) as { items: FunFact[] | QuizQuestion[] }

      // Validate structure
      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Invalid response structure: missing items array')
      }

      // Validate each item based on mode
      const validatedItems = parsed.items.slice(0, 5).map((item: any, index: number) => {
        if (mode === 'facts') {
          return {
            fact: String(item.fact || `Interesting fact #${index + 1}`),
            relatedTitle: String(item.relatedTitle || history[0]?.title || 'Unknown'),
            category: String(item.category || 'Trivia'),
          } as FunFact
        } else {
          const options = Array.isArray(item.options) && item.options.length === 4
            ? item.options.map(String)
            : ['Option A', 'Option B', 'Option C', 'Option D']
          const correctIndex = typeof item.correctIndex === 'number' && item.correctIndex >= 0 && item.correctIndex < 4
            ? item.correctIndex
            : 0
          return {
            question: String(item.question || `Question #${index + 1}`),
            options: options as [string, string, string, string],
            correctIndex,
            explanation: String(item.explanation || 'No explanation provided'),
            relatedTitle: String(item.relatedTitle || history[0]?.title || 'Unknown'),
          } as QuizQuestion
        }
      })

      return NextResponse.json({ items: validatedItems })
    } catch (llmError) {
      console.error('LLM trivia generation error:', llmError)

      // Generate fallback content
      if (mode === 'facts') {
        const fallbackItems: FunFact[] = history.slice(0, 5).map((item, i) => ({
          fact: `"${item.title}" is a ${item.type.toLowerCase()} in the ${item.genre || 'entertainment'} genre that has captivated audiences with its unique storytelling and creative vision.`,
          relatedTitle: item.title,
          category: ['Production', 'Cultural Impact', 'Cast', 'History', 'Trivia'][i % 5],
        }))
        return NextResponse.json({ items: fallbackItems })
      } else {
        const fallbackItems: QuizQuestion[] = history.slice(0, 5).map((item, i) => ({
          question: `What genre does "${item.title}" belong to?`,
          options: [
            item.genre || 'Drama',
            ['Action', 'Comedy', 'Horror', 'Romance'][i % 4],
            ['Sci-Fi', 'Thriller', 'Documentary', 'Fantasy'][i % 4],
            ['Animation', 'Musical', 'Mystery', 'Western'][i % 4],
          ] as [string, string, string, string],
          correctIndex: 0,
          explanation: `"${item.title}" is categorized as ${item.genre || 'Drama'}.`,
          relatedTitle: item.title,
        }))
        return NextResponse.json({ items: fallbackItems })
      }
    }
  } catch (error) {
    console.error('Media Trivia API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate trivia' },
      { status: 500 }
    )
  }
}
