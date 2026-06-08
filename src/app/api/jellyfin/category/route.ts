import { NextRequest, NextResponse } from 'next/server'
import { fetchJellyfinCategoryItems } from '@/lib/jellyfin-category'

/**
 * GET /api/jellyfin/category?type=MOVIE&limit=100
 *
 * Thin wrapper around the shared fetchJellyfinCategoryItems function.
 * The core logic is in src/lib/jellyfin-category.ts so it can be called
 * directly by other API routes (like /api/media) without an HTTP self-fetch.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '100')

  const result = await fetchJellyfinCategoryItems(type || '', limit)

  return NextResponse.json(result)
}
