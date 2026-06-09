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

    const url = new URL(request.url)
    const searchParams = url.searchParams
    const segment = searchParams.get('segment')

    const mediaSourceId = searchParams.get('mediaSourceId') || itemId
    const serverInfo = { serverUrl: server.serverUrl, accessToken: server.accessToken, userId: server.userId }

    if (segment) {
      return proxySegment(serverInfo, itemId, segment, mediaSourceId)
    }

    return proxyPlaylist(serverInfo, itemId, mediaSourceId)
  } catch (error) {
    console.error('Jellyfin HLS error:', error)
    return NextResponse.json({ error: 'Failed to stream HLS' }, { status: 500 })
  }
}

async function proxyPlaylist(
  server: { serverUrl: string; accessToken: string; userId: string },
  itemId: string,
  mediaSourceId: string
) {
  // Construct Jellyfin HLS playlist URL with the real user ID
  const hlsUrl = `${server.serverUrl}/Videos/${itemId}/main.m3u8?MediaSourceId=${mediaSourceId}&UserId=${server.userId}&VideoCodec=h264&AudioCodec=aac&Container=ts&TranscodingMaxAudioChannels=2&SegmentContainer=ts&MinSegments=1&BreakOnNonKeyFrames=True&api_key=${server.accessToken}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(hlsUrl, {
    headers: {
      'X-Emby-Token': server.accessToken,
    },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error('Jellyfin HLS playlist error:', res.status, errorBody.substring(0, 200))
    return NextResponse.json({ error: 'Failed to get HLS playlist' }, { status: res.status })
  }

  let content = await res.text()

  // The base URL for our proxy
  const proxyBase = `/api/jellyfin/hls/${itemId}`

  // Rewrite ALL segment URLs in the m3u8 to go through our proxy
  const serverUrlEscaped = server.serverUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Pattern 1: Absolute URLs pointing to the Jellyfin server
  content = content.replace(
    new RegExp(`${serverUrlEscaped}/Videos/${itemId}/([^\\s]+\\.ts[^\\s\\n]*)`, 'g'),
    (_match, segPath: string) => {
      return `${proxyBase}?segment=${encodeURIComponent(segPath)}&mediaSourceId=${mediaSourceId}`
    }
  )

  // Pattern 2: Relative paths (lines that contain .ts references)
  const lines = content.split('\n')
  const rewrittenLines = lines.map((line: string) => {
    const trimmed = line.trim()

    // Skip empty lines and directive lines
    if (!trimmed || trimmed.startsWith('#')) {
      return line
    }

    // If this line looks like a segment URL (contains .ts)
    if (trimmed.includes('.ts') && !trimmed.startsWith('/api/')) {
      return `${proxyBase}?segment=${encodeURIComponent(trimmed)}&mediaSourceId=${mediaSourceId}`
    }

    return line
  })

  content = rewrittenLines.join('\n')

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}

async function proxySegment(
  server: { serverUrl: string; accessToken: string; userId: string },
  itemId: string,
  segment: string,
  mediaSourceId: string
) {
  const decodedSegment = decodeURIComponent(segment)

  let segmentUrl: string

  if (decodedSegment.startsWith('/Videos/')) {
    segmentUrl = `${server.serverUrl}${decodedSegment}`
  } else if (decodedSegment.startsWith('http')) {
    segmentUrl = decodedSegment
  } else {
    // Relative path - prefix with server URL and Videos path
    // The segment already contains all query params from Jellyfin
    segmentUrl = `${server.serverUrl}/Videos/${itemId}/${decodedSegment}`
  }

  // Ensure api_key is present
  if (!segmentUrl.includes('api_key=')) {
    const separator = segmentUrl.includes('?') ? '&' : '?'
    segmentUrl += `${separator}api_key=${server.accessToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  const res = await fetch(segmentUrl, {
    headers: {
      'X-Emby-Token': server.accessToken,
    },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    console.error('Jellyfin HLS segment error:', res.status, 'segment:', decodedSegment.substring(0, 50))
    return NextResponse.json({ error: 'Failed to get segment' }, { status: res.status })
  }

  const contentType = res.headers.get('content-type') || 'video/mp2t'
  const body = res.body

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
