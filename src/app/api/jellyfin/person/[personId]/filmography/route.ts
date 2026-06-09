import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

const REQUEST_TIMEOUT = 10000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const server = await getJellyfinCredentials()
  if (!server) {
    return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
  }

  try {
    const fields =
      'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating'
    const url = `${server.serverUrl}/Items?UserId=${server.userId}&PersonIds=${personId}&IncludeItemTypes=Movie,Series,Episode,Audio,MusicAlbum,AudioBook,Book&Recursive=true&Fields=${fields}&SortBy=ProductionYear&SortOrder=Descending&Limit=30`

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

    const items = ((data.Items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => {
      const imageTags = item.ImageTags as Record<string, string> | undefined
      const backdropTags = item.BackdropImageTags as string[] | undefined

      return {
        id: `jf-${item.Id}`,
        jellyfinId: item.Id,
        title: (item.Name as string) || 'Untitled',
        type: item.Type,
        year: (item.ProductionYear as number) || 0,
        overview: (item.Overview as string) || '',
        genres: (item.Genres as string[]) || [],
        communityRating: item.CommunityRating as number | null,
        officialRating: (item.OfficialRating as string) || '',
        runTimeTicks: item.RunTimeTicks as number | null,
        thumbnail: imageTags?.Primary
          ? `/api/jellyfin/image/${item.Id}?tag=${imageTags.Primary}`
          : backdropTags?.[0]
            ? `/api/jellyfin/image/${item.Id}?tag=${backdropTags[0]}&type=Backdrop`
            : '',
        studios: ((item.Studios as Record<string, unknown>[]) || []).map((s) => s.Name as string),
      }
    })

    // Also fetch person details
    const personUrl = `${server.serverUrl}/Users/${server.userId}/Items/${personId}`
    const personRes = await fetch(personUrl, {
      headers: { 'X-Emby-Token': server.accessToken },
    })

    let personDetails: Record<string, unknown> | null = null
    if (personRes.ok) {
      const personData = (await personRes.json()) as Record<string, unknown>
      const personImageTags = personData.ImageTags as Record<string, string> | undefined

      personDetails = {
        id: personData.Id,
        name: personData.Name,
        overview: (personData.Overview as string) || '',
        imageUrl: personImageTags?.Primary
          ? `/api/jellyfin/image/${personData.Id}?type=Primary&tag=${personImageTags.Primary}`
          : '',
        birthDate: (personData.PremiereDate as string) || '',
        birthYear: (personData.ProductionYear as number) || 0,
        productionLocations: (personData.ProductionLocations as string[]) || [],
      }
    }

    return NextResponse.json({
      items,
      person: personDetails,
      total: (data.TotalRecordCount as number) || items.length,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Failed to fetch filmography:', err)
    return NextResponse.json({ error: 'Failed to fetch filmography' }, { status: 500 })
  }
}
