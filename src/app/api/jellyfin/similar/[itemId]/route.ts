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
    const fields =
      'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount'
    const url = `${server.serverUrl}/Items/${itemId}/Similar?UserId=${server.userId}&Fields=${fields}&Limit=12`

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
        isJellyfin: true,
        hasChildren: item.IsFolder === true || (item.ChildCount as number) > 0,
        childCount: (item.ChildCount as number) || 0,
        itemType: item.Type,
      }
    })

    return NextResponse.json({ items, total: (data.TotalRecordCount as number) || items.length })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Failed to fetch similar items:', err)
    return NextResponse.json({ error: 'Failed to fetch similar items' }, { status: 500 })
  }
}
