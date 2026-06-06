# Task 7 - AI Extended Backend Agent

## Task
Create three new backend API endpoints for AI features: Companion, Discovery, Collections

## Work Completed

### 1. POST `/api/ai/companion/route.ts` - AI Movie Companion
- Accepts `{ query, itemId, currentTime?, spoilerProtection? }`
- Fetches item details from Jellyfin with People, Genres, Studios, etc.
- Extracts actors (with roles), directors, writers from People array
- Builds rich context and calls LLM with spoiler-aware system prompt
- Returns `{ answer, relatedInfo?, spoilerWarning? }`
- Fallback: provides context-based answers for common queries (cast, director, overview, genre, rating)

### 2. POST `/api/ai/discovery/route.ts` - Semantic Discovery Engine
- Accepts `{ query, discoveryType: "semantic"|"mood"|"thematic" }`
- Fetches ALL items with People metadata for richer catalog
- Builds catalog with actors, directors, official rating
- Three discovery modes: semantic (conceptual), mood (emotional), thematic (narrative patterns)
- Returns `{ items, interpretation, themes, suggestions }`
- Keyword fallback if LLM fails

### 3. POST `/api/ai/collections/route.ts` - Smart Collections
- Accepts `{ collectionType, referenceItemId? }` with 7 collection types
- "auto" type: LLM generates 5-8 diverse themed collections, falls back to rule-based
- Specific types: rule-based filtering (oscar, cult_classic, hidden_gems, family, decade_90s, similar_to)
- "similar_to": uses genre/people/studio overlap scoring
- Returns `{ collections: [{ id, title, description, items, icon }] }`

## Patterns Followed
- Same JellyfinItem interface, determineType, mapJellyfinItem as concierge/radio
- `import { db } from '@/lib/db'` for DB access
- `import ZAI from 'z-ai-web-dev-sdk'` for LLM
- LLM timeout handling (20-30s)
- JSON parsing with markdown wrapper handling
- Proper error handling with HTTP status codes
- Graceful fallbacks

## Verification
- `bun run lint` passes cleanly
- Dev server compiles without errors
