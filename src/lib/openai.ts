import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-4o-mini'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    _client = new OpenAI({ apiKey })
  }
  return _client
}

export function getDefaultModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL
}

/**
 * Helper to create a chat completion with the default model.
 * Matches the same call signature as z-ai-web-dev-sdk's chat.completions.create
 * for easy drop-in replacement.
 */
export async function chatCompletion(params: {
  messages: Array<{ role: string; content: string }>
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
  stream?: false
}): Promise<OpenAI.ChatCompletion>

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: string }>
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
  stream: true
}): Promise<AsyncIterable<OpenAI.ChatCompletionChunk>>

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: string }>
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
  stream?: boolean
}): Promise<OpenAI.ChatCompletion | AsyncIterable<OpenAI.ChatCompletionChunk>> {
  const client = getOpenAIClient()
  return client.chat.completions.create({
    model: params.model || getDefaultModel(),
    messages: params.messages as OpenAI.ChatCompletionMessageParam[],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens,
    response_format: params.response_format as OpenAI.ChatCompletionCreateParams['response_format'],
    stream: params.stream,
  }) as Promise<OpenAI.ChatCompletion>
}
