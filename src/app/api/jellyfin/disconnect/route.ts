import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { mediaCache } from '@/lib/media-cache'

export async function DELETE() {
  try {
    await db.jellyfinServer.deleteMany()
    // Clear all cached media data
    await mediaCache.clear()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Jellyfin disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
