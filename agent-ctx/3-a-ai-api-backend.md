# Task 3-a: AI API Backend Agent

## Summary
Built two backend API endpoints for AI-powered features using the `z-ai-web-dev-sdk` LLM package.

## Files Created
1. `/home/z/my-project/src/app/api/ai/concierge/route.ts` — POST /api/ai/concierge
2. `/home/z/my-project/src/app/api/ai/radio/route.ts` — POST /api/ai/radio

## Endpoint Details

### POST /api/ai/concierge
- **Request**: `{ query: string }` — natural language query
- **Response**: `{ items: MediaItem[], interpretation: string, suggestions: string[] }`
- **Flow**:
  1. Get Jellyfin credentials from DB
  2. Fetch library structure (Views API) for type mapping
  3. Fetch all items (Movies, Series, Audio, AudioBook, limit 500)
  4. Build condensed catalog for LLM
  5. Call z-ai-web-dev-sdk to select matching item IDs
  6. Map results to MediaItem format (consistent with /api/jellyfin/items)
  7. Fall back to keyword search if LLM fails

### POST /api/ai/radio
- **Request**: `{ type: "mood"|"genre"|"personalized", mood?: string, genre?: string, description?: string }`
- **Response**: `{ tracks: MediaItem[], stationName: string, description: string }`
- **Flow**:
  1. Validate request based on type
  2. Get Jellyfin credentials from DB
  3. Fetch all audio tracks (limit 1000)
  4. Build condensed catalog for LLM
  5. Call z-ai-web-dev-sdk to curate a playlist (15-25 tracks)
  6. Map results to MediaItem format with type='MUSIC' and parentId for queue
  7. Fall back to keyword search if LLM fails

## Key Design Decisions
- MediaItem mapping is fully consistent with existing `/api/jellyfin/items/route.ts`
- Type mapping accounts for library context (podcast libraries → PODCAST, books → AUDIOBOOK)
- LLM responses are parsed with markdown wrapper handling (```json blocks)
- Keyword fallback ensures the endpoints still work if LLM is unavailable
- All items include `isJellyfin: true` and `jellyfinId` fields
- Audio tracks include `parentId` (album ID) for queue population

## Verification
- ESLint passes with no errors
- Dev server compiles without issues
