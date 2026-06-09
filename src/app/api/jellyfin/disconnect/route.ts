import { NextResponse } from 'next/server'
import { mediaCache } from '@/lib/media-cache'

export async function DELETE() {
  try {
    try {
      const { db } = await import('@/lib/db')
      await db.jellyfinServer.deleteMany()
    } catch (dbErr) {
      console.error('Jellyfin disconnect DB error (non-fatal):', dbErr)
    }
    // Clear all cached media data
    try {
      await mediaCache.clear()
    } catch (cacheErr) {
      console.error('Jellyfin disconnect cache clear error (non-fatal):', cacheErr)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Jellyfin disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
