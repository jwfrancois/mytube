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
    const mediaType = searchParams.get('mediaType') || 'video'

    // Build the appropriate Jellyfin streaming URL based on media type
    let streamUrl: string
    if (mediaType === 'audio' || mediaType === 'music') {
      // Use Audio endpoint with mp3 transcoding for browser compatibility
      streamUrl = `${server.serverUrl}/Audio/${itemId}/stream.mp3?MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}`
    } else {
      // Use Videos endpoint with direct stream for movies/episodes
      streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}`
    }

    // Forward the Range header from the client for seeking support
    const headers: Record<string, string> = {}

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }

    // Fetch from Jellyfin with extended timeout for streaming
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const res = await fetch(streamUrl, {
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 206) {
      console.error('Jellyfin stream error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ error: 'Failed to stream from Jellyfin' }, { status: res.status })
    }

    // Get the response headers
    const contentType = res.headers.get('content-type') || (mediaType === 'audio' || mediaType === 'music' ? 'audio/mpeg' : 'video/mp4')
    const contentLength = res.headers.get('content-length')
    const contentRange = res.headers.get('content-range')
    const acceptRanges = res.headers.get('accept-ranges') || 'bytes'
    const statusCode = res.status === 206 ? 206 : 200

    // Stream the response body back to the client
    const body = res.body

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'public, max-age=3600',
    }

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    return new NextResponse(body, {
      status: statusCode,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Jellyfin stream error:', error)
    return NextResponse.json({ error: 'Failed to stream' }, { status: 500 })
  }
}
