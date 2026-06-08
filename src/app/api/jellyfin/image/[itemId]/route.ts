import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    const maxWidth = searchParams.get('maxWidth') || '480'

    const url = `${creds.serverUrl}/Items/${itemId}/Images/Primary${tag ? `?tag=${tag}&maxWidth=${maxWidth}` : `?maxWidth=${maxWidth}`}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      headers: {
        'X-Emby-Token': creds.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Jellyfin image error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
