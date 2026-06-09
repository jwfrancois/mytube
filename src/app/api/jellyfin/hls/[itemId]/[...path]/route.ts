import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Universal proxy for Jellyfin HLS streaming.
 *
 * Handles two cases:
 * 1. Master playlist request:  /api/jellyfin/hls/{itemId}
 *    → Proxies /Videos/{itemId}/stream.m3u8 from Jellyfin
 *    → Rewrites all relative URLs so segment requests also go through this proxy
 *
 * 2. Segment / sub-playlist request: /api/jellyfin/hls/{itemId}/main/0.ts  etc.
 *    → Proxies the corresponding path from Jellyfin
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string; path?: string[] }> }
) {
  try {
    const { itemId, path } = await params
    let server = null
    try {
      server = await db.jellyfinServer.findFirst()
    } catch (dbError) {
      console.error('DB error (non-fatal):', dbError)
    }

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const mediaSourceId = searchParams.get('mediaSourceId') || itemId

    // Build the upstream Jellyfin URL
    let jellyfinUrl: string
    const isMasterPlaylist = !path || path.length === 0

    if (isMasterPlaylist) {
      // Request the HLS master playlist from Jellyfin with transcoding params
      jellyfinUrl = `${server.serverUrl}/Videos/${itemId}/stream.m3u8?MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&Static=false&VideoCodec=h264&AudioCodec=aac&Container=ts&SegmentContainer=ts&MinSegments=1&BreakOnNonKeyFrames=true&TranscodeReasons=ContainerBitrateExceedsLimit`
    } else {
      // Proxy segment or sub-playlist requests
      // path could be ["main", "0.ts"] or ["0.ts"] etc.
      const subPath = path.join('/')
      jellyfinUrl = `${server.serverUrl}/Videos/${itemId}/${subPath}?api_key=${server.accessToken}`

      // Forward any additional query params (like MediaSourceId on sub-playlists)
      const extraParams = new URLSearchParams()
      for (const [key, value] of searchParams.entries()) {
        if (key !== 'api_key' && key !== 'MediaSourceId') {
          extraParams.set(key, value)
        }
      }
      if (extraParams.toString()) {
        jellyfinUrl += `&${extraParams.toString()}`
      }
    }

    // Fetch from Jellyfin
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(jellyfinUrl, {
      signal: controller.signal,
      headers: {
        // Some Jellyfin versions need this for proper HLS generation
        Accept: isMasterPlaylist ? 'application/x-mpegURL, application/vnd.apple.mpegurl' : '*/*',
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error('[Jellyfin HLS] Upstream error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json(
        { error: `Jellyfin returned ${res.status}` },
        { status: res.status }
      )
    }

    const contentType = res.headers.get('content-type') || ''

    // If this is a playlist (master or variant), rewrite URLs to go through our proxy
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegURL') ||
      (isMasterPlaylist && contentType.includes('octet-stream'))
    ) {
      const playlistText = await res.text()

      // Rewrite relative URLs in the playlist to go through our proxy
      // The base path for this item's HLS stream is: /api/jellyfin/hls/{itemId}/
      const basePath = `/api/jellyfin/hls/${itemId}/`

      const rewritten = rewritePlaylistUrls(playlistText, basePath)

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-mpegURL',
          'Cache-Control': 'no-cache, no-store',
        },
      })
    }

    // For segments (.ts files) and other binary data, stream directly
    const body = res.body
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'video/mp2t',
      'Cache-Control': 'public, max-age=3600',
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    return new NextResponse(body, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[Jellyfin HLS] Proxy error:', error)
    return NextResponse.json({ error: 'Failed to stream HLS' }, { status: 503 })
  }
}

/**
 * Rewrite URLs in an HLS playlist so they route through our proxy.
 *
 * Handles:
 * - Relative URLs (e.g., "main/0.ts", "main/0.ts?params")
 * - Absolute paths (e.g., "/Videos/itemId/main/0.ts")
 * - Full URLs pointing to the Jellyfin server
 * - Does NOT touch lines starting with # (directives) unless they contain URI attributes
 */
function rewritePlaylistUrls(playlist: string, proxyBasePath: string): string {
  const lines = playlist.split('\n')
  const result: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments without URLs
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI='))) {
      result.push(line)
      continue
    }

    // Handle #EXT-X-MAP or #EXT-X-KEY with URI attribute
    if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
      const rewritten = rewriteUriAttribute(trimmed, proxyBasePath)
      result.push(rewritten)
      continue
    }

    // Skip other directive lines
    if (trimmed.startsWith('#')) {
      result.push(line)
      continue
    }

    // This is a URL line - rewrite it
    result.push(rewriteUrl(trimmed, proxyBasePath))
  }

  return result.join('\n')
}

function rewriteUrl(url: string, proxyBasePath: string): string {
  // If already a full URL through our proxy, leave as-is
  if (url.startsWith('/api/jellyfin/hls/')) {
    return url
  }

  // If it's a relative URL, prepend our proxy base path
  if (!url.startsWith('http') && !url.startsWith('/')) {
    return `${proxyBasePath}${url}`
  }

  // If it's an absolute path like /Videos/..., convert to proxy path
  if (url.startsWith('/')) {
    // Extract the path after /Videos/{itemId}/
    const match = url.match(/^\/Videos\/[^/]+\/(.+)$/)
    if (match) {
      return `${proxyBasePath}${match[1]}`
    }
    // Fallback: just use it as-is relative to proxy base
    return `${proxyBasePath}${url.startsWith('/') ? url.slice(1) : url}`
  }

  // Full URL - shouldn't normally happen with Jellyfin, but handle it
  return url
}

function rewriteUriAttribute(line: string, proxyBasePath: string): string {
  // Match URI="..." in the line
  return line.replace(/URI="([^"]+)"/, (_match, uri: string) => {
    const rewritten = rewriteUrl(uri, proxyBasePath)
    return `URI="${rewritten}"`
  })
}
