import { fetchCollectionItems } from '@/lib/jellyfin-cache'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/collection?collectionId=xxx
 * Fetch items within a BoxSet collection.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get('collectionId')

    if (!collectionId) {
      return NextResponse.json({ error: 'collectionId required' }, { status: 400 })
    }

    const items = await fetchCollectionItems(collectionId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error fetching collection items:', error)
    return NextResponse.json({ error: 'Failed to fetch collection items' }, { status: 500 })
  }
}
