import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const mediaSourceId = searchParams.get('mediaSourceId') || itemId
    const staticStreaming = searchParams.get('static') || 'true'

    // Build the streaming URL - request direct stream
    const streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?MediaSourceId=${mediaSourceId}&Static=${staticStreaming}&api_key=${server.accessToken}`

    // Redirect to the Jellyfin stream URL
    return NextResponse.redirect(streamUrl)
  } catch (error) {
    console.error('Jellyfin stream error:', error)
    return NextResponse.json({ error: 'Failed to stream' }, { status: 500 })
  }
}
