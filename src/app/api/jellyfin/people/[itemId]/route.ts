import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

const REQUEST_TIMEOUT = 10000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  const server = await getJellyfinCredentials()
  if (!server) {
    return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
  }

  try {
    const url = `${server.serverUrl}/Users/${server.userId}/Items/${itemId}?Fields=People,Overview,Genres,Studios,CommunityRating,OfficialRating,ProductionLocations,PremiereDate,RunTimeTicks,ProductionYear,MediaSources,Tags`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: `Jellyfin returned ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    // Process People array
    const people = (data.People || []).map((person: Record<string, unknown>) => ({
      id: person.Id,
      name: person.Name,
      role: (person.Role as string) || '',
      type: (person.Type as string) || 'Actor', // Actor, Director, Writer, Producer, etc.
      primaryImageTag: (person.PrimaryImageTag as string) || '',
      imageUrl: person.PrimaryImageTag
        ? `/api/jellyfin/image/${person.Id}?type=Primary&tag=${person.PrimaryImageTag}`
        : '',
      sortOrder: (person.SortOrder as number) ?? 999,
    }))

    // Also return rich item metadata from the Jellyfin response
    const itemMetadata = {
      overview: (data.Overview as string) || '',
      genres: (data.Genres as string[]) || [],
      studios: ((data.Studios as Record<string, unknown>[]) || []).map((s) => ({
        id: s.Id,
        name: s.Name,
        imageUrl: s.PrimaryImageTag
          ? `/api/jellyfin/image/${s.Id}?type=Primary&tag=${s.PrimaryImageTag}`
          : '',
      })),
      communityRating: data.CommunityRating as number | null,
      officialRating: (data.OfficialRating as string) || '',
      productionLocations: (data.ProductionLocations as string[]) || [],
      premiereDate: (data.PremiereDate as string) || '',
      runTimeTicks: data.RunTimeTicks as number | null,
      productionYear: data.ProductionYear as number | null,
      tags: (data.Tags as string[]) || [],
      // Media info
      mediaSources: ((data.MediaSources as Record<string, unknown>[]) || []).map((ms) => ({
        id: ms.Id,
        name: ms.Name,
        container: (ms.Container as string) || '',
        size: (ms.Size as number) || 0,
        bitrate: (ms.Bitrate as number) || 0,
        mediaStreams: ((ms.MediaStreams as Record<string, unknown>[]) || []).map(
          (stream: Record<string, unknown>) => ({
            type: stream.Type,
            codec: (stream.Codec as string) || '',
            language: (stream.Language as string) || '',
            channels: (stream.Channels as number) || 0,
            sampleRate: (stream.SampleRate as number) || 0,
            bitRate: (stream.BitRate as number) || 0,
            width: (stream.Width as number) || 0,
            height: (stream.Height as number) || 0,
            aspectRatio: (stream.AspectRatio as string) || '',
            frameRate: (stream.RealFrameRate as number) || 0,
            bitDepth: (stream.BitDepth as number) || 0,
            title: (stream.Title as string) || '',
            displayTitle: (stream.DisplayTitle as string) || '',
          })
        ),
      })),
    }

    return NextResponse.json({ people, itemMetadata })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Failed to fetch people:', err)
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 })
  }
}
