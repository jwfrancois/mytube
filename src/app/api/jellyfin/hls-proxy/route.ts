import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * HLS Proxy — proxies m3u8 playlists and .ts segments from Jellyfin
 * to avoid CORS issues when hls.js tries to fetch directly from the server.
 *
 * Usage: /api/jellyfin/hls-proxy?url=<encoded_jellyfin_url>
 *
 * For m3u8 playlists, rewrites segment URLs to also go through this proxy.
 * For .ts segments and other media, proxies the binary data directly.
 */
export async function GET(request: NextRequest) {
  try {
    const server = await db.jellyfinServer.findFirst()
    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Only allow proxying to the configured Jellyfin server
    if (!targetUrl.startsWith(server.serverUrl)) {
      return NextResponse.json({ error: 'URL must point to the configured Jellyfin server' }, { status: 403 })
    }

    // Ensure the URL has authentication — add api_key if not present
    let authedUrl = targetUrl
    if (!targetUrl.includes('api_key=') && !targetUrl.includes('ApiKey=')) {
      const separator = targetUrl.includes('?') ? '&' : '?'
      authedUrl = `${targetUrl}${separator}api_key=${server.accessToken}`
    }

    // Fetch the content from Jellyfin
    // Use a long timeout — Jellyfin may need to start transcoding before returning the playlist
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const res = await fetch(authedUrl, {
      headers: {
        'X-Emby-Token': server.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 206) {
      console.error('HLS proxy fetch error:', res.status, targetUrl)
      return NextResponse.json({ error: `Jellyfin returned ${res.status}` }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || ''

    // If it's an m3u8 playlist, rewrite URLs to go through the proxy
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.includes('.m3u8')
    ) {
      const playlistText = await res.text()
      const rewritten = rewriteHlsPlaylist(playlistText, targetUrl, server.serverUrl)

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // For .ts segments and other media, proxy the binary data directly
    const body = res.body
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'video/mp2t',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    const contentRange = res.headers.get('content-range')
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    return new NextResponse(body, {
      status: res.status === 206 ? 206 : 200,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('HLS proxy error:', error)
    return NextResponse.json({ error: 'HLS proxy failed' }, { status: 500 })
  }
}

/**
 * Rewrite URLs in an HLS m3u8 playlist to go through our proxy.
 * Handles both absolute and relative URLs.
 */
function rewriteHlsPlaylist(playlistText: string, playlistUrl: string, serverUrl: string): string {
  // Parse the base URL for resolving relative paths
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

  const lines = playlistText.split('\n')
  const rewritten: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments (but process #EXT-X-KEY and #EXT-X-MAP which have URLs)
    if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      rewritten.push(line)
      continue
    }

    // Handle #EXT-X-KEY and #EXT-X-MAP directives with URI attributes
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      const rewrittenLine = line.replace(/URI="([^"]+)"/g, (match, uri) => {
        const absoluteUrl = resolveUrl(uri, baseUrl, serverUrl)
        const proxyUrl = buildProxyUrl(absoluteUrl)
        return `URI="${proxyUrl}"`
      })
      rewritten.push(rewrittenLine)
      continue
    }

    // Handle segment URLs (lines that aren't comments)
    if (!trimmed.startsWith('#')) {
      const absoluteUrl = resolveUrl(trimmed, baseUrl, serverUrl)
      const proxyUrl = buildProxyUrl(absoluteUrl)
      rewritten.push(proxyUrl)
      continue
    }

    rewritten.push(line)
  }

  return rewritten.join('\n')
}

/**
 * Resolve a URL relative to a base URL.
 */
function resolveUrl(url: string, baseUrl: string, serverUrl: string): string {
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // Protocol-relative
  if (url.startsWith('//')) {
    return `https:${url}`
  }

  // Absolute path on the server
  if (url.startsWith('/')) {
    // Extract origin from serverUrl
    try {
      const origin = new URL(serverUrl).origin
      return `${origin}${url}`
    } catch {
      return `${serverUrl}${url}`
    }
  }

  // Relative path
  return `${baseUrl}${url}`
}

/**
 * Build a proxy URL that goes through our API route.
 */
function buildProxyUrl(targetUrl: string): string {
  return `/api/jellyfin/hls-proxy?url=${encodeURIComponent(targetUrl)}`
}
