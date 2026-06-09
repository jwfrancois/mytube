import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy for Live TV HLS segments to avoid CORS issues.
 * This is the same pattern as the Jellyfin HLS proxy but for external Live TV streams.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MyTube/1.0',
        'Accept': '*/*',
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Segment fetch failed: ${res.status}` },
        { status: res.status }
      )
    }

    const contentType = res.headers.get('content-type') || 'video/mp2t'

    // Check if this is actually a playlist (multi-variant master or media playlist)
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.includes('.m3u8')
    ) {
      const playlistText = await res.text()
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)
      const rewritten = rewritePlaylist(playlistText, baseUrl)

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Binary segment data — proxy directly
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength) responseHeaders['Content-Length'] = contentLength

    return new NextResponse(res.body, { status: 200, headers: responseHeaders })
  } catch (error) {
    console.error('Live TV segment proxy error:', error)
    return NextResponse.json({ error: 'Segment proxy failed' }, { status: 500 })
  }
}

function rewritePlaylist(playlistText: string, baseUrl: string): string {
  const lines = playlistText.split('\n')
  const rewritten: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      rewritten.push(line)
      continue
    }

    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      const rewrittenLine = line.replace(/URI="([^"]+)"/g, (_match: string, uri: string) => {
        const absoluteUrl = resolveUrl(uri, baseUrl)
        const proxyUrl = `/api/livetv/proxy-segment?url=${encodeURIComponent(absoluteUrl)}`
        return `URI="${proxyUrl}"`
      })
      rewritten.push(rewrittenLine)
      continue
    }

    if (!trimmed.startsWith('#')) {
      const absoluteUrl = resolveUrl(trimmed, baseUrl)
      const proxyUrl = `/api/livetv/proxy-segment?url=${encodeURIComponent(absoluteUrl)}`
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
