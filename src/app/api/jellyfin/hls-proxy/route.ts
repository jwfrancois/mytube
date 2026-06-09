import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

/**
 * HLS Proxy — proxies m3u8 playlists and .ts segments from Jellyfin
 * to avoid CORS and Mixed Content issues when the browser on HTTPS (Vercel)
 * tries to fetch from a Jellyfin NAS that may be HTTP or a different origin.
 */

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(targetUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 })
    }

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 })
    }

    // Get credentials for auth and optional URL validation
    const creds = await getJellyfinCredentials()

    // If we have credentials, validate the URL points to our Jellyfin server
    // Be lenient: allow http/https mismatch and trailing slash differences
    if (creds?.serverUrl) {
      const normalizeUrl = (u: string) => u.replace(/\/+$/, '').replace(/^http:/, 'https:')
      const normalizedTarget = normalizeUrl(parsedUrl.origin)
      const normalizedServer = normalizeUrl(new URL(creds.serverUrl).origin)

      if (normalizedTarget !== normalizedServer) {
        console.warn(`[HLS Proxy] URL origin mismatch: target=${normalizedTarget}, server=${normalizedServer}`)
        // Don't block — the URL might still be valid (e.g., CDN or reverse proxy)
      }
    }

    // Ensure the URL has authentication — add api_key if missing
    let authedUrl = targetUrl
    if (!targetUrl.includes('api_key=') && !targetUrl.includes('ApiKey=')) {
      if (creds?.accessToken) {
        const separator = targetUrl.includes('?') ? '&' : '?'
        authedUrl = `${targetUrl}${separator}api_key=${creds.accessToken}`
      }
    }

    // Fetch from Jellyfin with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let res: Response
    try {
      const fetchHeaders: Record<string, string> = {}
      if (creds?.accessToken) {
        fetchHeaders['X-Emby-Token'] = creds.accessToken
      }

      res = await fetch(authedUrl, {
        headers: fetchHeaders,
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      console.error('[HLS Proxy] Fetch error:', fetchErr)
      return NextResponse.json(
        { error: `Failed to reach Jellyfin server: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` },
        { status: 502 }
      )
    }

    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 206) {
      const errorBody = await res.text().catch(() => '')
      console.error(`[HLS Proxy] Jellyfin returned ${res.status} for: ${targetUrl.substring(0, 100)}...`, errorBody.substring(0, 200))
      return NextResponse.json(
        { error: `Jellyfin returned ${res.status}` },
        { status: res.status }
      )
    }

    const contentType = res.headers.get('content-type') || ''

    // If it's an m3u8 playlist, rewrite URLs to go through the proxy
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.includes('.m3u8')
    ) {
      const playlistText = await res.text()
      const rewritten = rewriteHlsPlaylist(playlistText, targetUrl)

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
    try {
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
    } catch (streamErr) {
      console.error('[HLS Proxy] Error streaming segment:', streamErr)
      return NextResponse.json({ error: 'Failed to stream segment' }, { status: 500 })
    }
  } catch (error) {
    console.error('[HLS Proxy] Fatal error:', error)
    return NextResponse.json(
      { error: `HLS proxy failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

function rewriteHlsPlaylist(playlistText: string, playlistUrl: string): string {
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

  let m3u8QueryString = ''
  try {
    const urlObj = new URL(playlistUrl)
    m3u8QueryString = urlObj.search
  } catch {
    const qIndex = playlistUrl.indexOf('?')
    if (qIndex >= 0) {
      m3u8QueryString = playlistUrl.substring(qIndex)
    }
  }

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
        let absoluteUrl = resolveUrl(uri, baseUrl)
        absoluteUrl = appendQueryString(absoluteUrl, m3u8QueryString)
        const proxyUrl = buildProxyUrl(absoluteUrl)
        return `URI="${proxyUrl}"`
      })
      rewritten.push(rewrittenLine)
      continue
    }

    if (!trimmed.startsWith('#')) {
      let absoluteUrl = resolveUrl(trimmed, baseUrl)
      absoluteUrl = appendQueryString(absoluteUrl, m3u8QueryString)
      const proxyUrl = buildProxyUrl(absoluteUrl)
      rewritten.push(proxyUrl)
      continue
    }

    rewritten.push(line)
  }

  return rewritten.join('\n')
}

function appendQueryString(targetUrl: string, queryString: string): string {
  if (!queryString || queryString === '?') return targetUrl

  const targetUrlIndex = targetUrl.indexOf('?')
  const targetHasQuery = targetUrlIndex >= 0

  if (!targetHasQuery) {
    return `${targetUrl}${queryString}`
  }

  const targetBase = targetUrl.substring(0, targetUrlIndex)
  const targetQuery = targetUrl.substring(targetUrlIndex + 1)

  const m3u8Params = new URLSearchParams(queryString.startsWith('?') ? queryString.substring(1) : queryString)
  const targetParams = new URLSearchParams(targetQuery)

  const merged = new URLSearchParams(m3u8Params)
  for (const [key, value] of targetParams) {
    merged.set(key, value)
  }

  return `${targetBase}?${merged.toString()}`
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  if (url.startsWith('//')) {
    return `https:${url}`
  }

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
  return `/api/jellyfin/hls-proxy?url=${encodeURIComponent(targetUrl)}`
}
