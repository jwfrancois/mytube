import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE() {
  try {
    await db.jellyfinServer.deleteMany()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Jellyfin disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
