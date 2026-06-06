import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getChannelById, BUILT_IN_CHANNELS } from '@/lib/livetv-channels'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'm3u8' // 'm3u8' | 'direct'

    // Check if it's a Jellyfin live TV channel
    if (channelId.startsWith('jellyfin-')) {
      return handleJellyfinLiveTV(channelId.replace('jellyfin-', ''), format)
    }

    // Look up the channel in our built-in database
    const channel = getChannelById(channelId)
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // For M3U8 format, proxy the playlist and rewrite URLs
    if (format === 'm3u8') {
      return await proxyM3U8(channel.streamUrl)
    }

    // For direct format, redirect to the stream URL
    return NextResponse.redirect(channel.streamUrl)
  } catch (error) {
    console.error('Live TV stream error:', error)
    return NextResponse.json({ error: 'Failed to stream channel' }, { status: 500 })
  }
}

/**
 * Proxy an M3U8 playlist and rewrite segment URLs through our proxy.
 * This avoids CORS issues when hls.js tries to fetch segments directly.
 */
async function proxyM3U8(streamUrl: string): Promise<NextResponse> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(streamUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MyTube/1.0',
        'Accept': '*/*',
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error('M3U8 fetch error:', res.status, streamUrl)
      return NextResponse.json(
        { error: `Failed to fetch stream: ${res.status}` },
        { status: res.status }
      )
    }

    const contentType = res.headers.get('content-type') || ''
    const isPlaylist =
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      streamUrl.includes('.m3u8')

    if (isPlaylist) {
      const playlistText = await res.text()
      const rewritten = rewritePlaylist(playlistText, streamUrl)

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // If it's not a playlist (could be a segment), proxy the data directly
    const body = res.body
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'video/mp2t',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength) responseHeaders['Content-Length'] = contentLength

    return new NextResponse(body, { status: 200, headers: responseHeaders })
  } catch (err) {
    console.error('M3U8 proxy error:', err)
    return NextResponse.json({ error: 'Stream proxy failed' }, { status: 500 })
  }
}

/**
 * Rewrite URLs in an HLS m3u8 playlist to go through our proxy.
 */
function rewritePlaylist(playlistText: string, playlistUrl: string): string {
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

  const lines = playlistText.split('\n')
  const rewritten: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments (except those with URI)
    if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      rewritten.push(line)
      continue
    }

    // Handle #EXT-X-KEY and #EXT-X-MAP with URI attributes
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      const rewrittenLine = line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        const absoluteUrl = resolveUrl(uri, baseUrl)
        const proxyUrl = buildProxyUrl(absoluteUrl)
        return `URI="${proxyUrl}"`
      })
      rewritten.push(rewrittenLine)
      continue
    }

    // Handle segment URLs
    if (!trimmed.startsWith('#')) {
      const absoluteUrl = resolveUrl(trimmed, baseUrl)
      const proxyUrl = buildProxyUrl(absoluteUrl)
      rewritten.push(proxyUrl)
      continue
    }

    rewritten.push(line)
  }

  return rewritten.join('\n')
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) {
    try {
      const origin = new URL(baseUrl).origin
      return `${origin}${url}`
    } catch {
      return `${baseUrl}${url}`
    }
  }
  return `${baseUrl}${url}`
}

function buildProxyUrl(targetUrl: string): string {
  return `/api/livetv/proxy-segment?url=${encodeURIComponent(targetUrl)}`
}

/**
 * Handle Jellyfin Live TV stream requests.
 */
async function handleJellyfinLiveTV(channelId: string, format: string): Promise<NextResponse> {
  try {
    const server = await db.jellyfinServer.findFirst()
    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    // Get the channel's stream URL from Jellyfin
    const deviceId = `mytube-server-${server.id}`
    const streamUrl = `${server.serverUrl}/LiveTv/LiveStreamFiles/${channelId}/stream.ts?api_key=${server.accessToken}&DeviceId=${deviceId}`

    if (format === 'm3u8') {
      // Try to get an HLS stream from Jellyfin
      const hlsUrl = `${server.serverUrl}/Videos/${channelId}/stream.m3u8?api_key=${server.accessToken}&DeviceId=${deviceId}&MediaSourceId=${channelId}`
      
      // Proxy through our Jellyfin HLS proxy
      const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`
      
      return NextResponse.json({
        url: proxyUrl,
        format: 'hls',
        channelId,
      })
    }

    // Direct stream
    return NextResponse.redirect(streamUrl)
  } catch (error) {
    console.error('Jellyfin Live TV stream error:', error)
    return NextResponse.json({ error: 'Failed to stream Jellyfin Live TV' }, { status: 500 })
  }
}
