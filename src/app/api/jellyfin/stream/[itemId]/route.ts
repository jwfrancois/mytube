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
    const directStream = searchParams.get('directStream') !== 'false'

    // Build the appropriate Jellyfin streaming URL based on media type
    let streamUrl: string
    if (mediaType === 'audio' || mediaType === 'music') {
      // Use Audio endpoint with mp3 transcoding for browser compatibility
      streamUrl = `${server.serverUrl}/Audio/${itemId}/stream.mp3?MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&Static=true`
    } else if (directStream) {
      // Try direct stream first — this returns the original file without transcoding.
      // Most modern browsers can play H.264 + AAC/MP3 in MP4 containers natively.
      // This avoids the no-sound issue caused by transcoding failures.
      // If the original file has incompatible codecs, the browser will show an error,
      // and the player can retry with transcode mode.
      streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}`
    } else {
      // Fallback: Use transcoding parameters for browser-compatible playback
      // This ensures both video (H.264) and audio (AAC/MP3) are in formats the browser can play
      const tparams = new URLSearchParams({
        MediaSourceId: mediaSourceId,
        api_key: server.accessToken,
        VideoCodec: 'h264',
        AudioCodec: 'aac,mp3',
        Container: 'mp4,m4a',
        TranscodingMaxAudioChannels: '2',
        SegmentContainer: 'mp4',
        MinSegments: '1',
        BreakOnNonKeyFrames: 'true',
      })
      streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?${tparams.toString()}`
    }

    // Forward the Range header from the client for seeking support
    const headers: Record<string, string> = {}
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }

    // Fetch from Jellyfin with extended timeout for streaming
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

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
