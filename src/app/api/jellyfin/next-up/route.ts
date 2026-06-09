import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/next-up
 * Returns the next episode to watch for each TV series the user is following.
 */
export async function GET() {
  try {
    const server = await getJellyfinCredentials()
    if (!server) {
      return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
    }

    const fields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,MediaSources,BackdropImageTags'
    const url = `${server.serverUrl}/Shows/NextUp?UserId=${server.userId}&Limit=20&Fields=${fields}&ImageTypeLimit=1`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: `Jellyfin returned ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    const items = (data.Items || []).map((item: any) => {
      let duration = ''
      if (item.RunTimeTicks) {
        const totalMinutes = Math.floor(item.RunTimeTicks / 600000000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
      }

      return {
        id: `jf-${item.Id}`,
        title: item.Name || 'Untitled',
        description: item.Overview || '',
        type: 'TV_SHOW',
        genre: (item.Genres || []).join(', '),
        thumbnail: item.ImageTags?.Primary
          ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
          : item.BackdropImageTags?.[0]
            ? `/api/jellyfin/image/${item.Id}?tag=${item.BackdropImageTags[0]}&type=Backdrop`
            : '',
        videoUrl: '',
        duration,
        durationTicks: item.RunTimeTicks || 0,
        releaseYear: item.ProductionYear || 0,
        artist: '',
        views: 0,
        channel: item.OfficialRating || server.name,
        createdAt: item.DateCreated || new Date().toISOString(),
        isJellyfin: true,
        jellyfinId: item.Id,
        itemType: item.Type,
        parentId: item.ParentId,
        hasChildren: false,
        childCount: 0,
        communityRating: item.CommunityRating,
        indexNumber: item.IndexNumber,
        parentIndexNumber: item.ParentIndexNumber,
        seriesName: item.SeriesName || '',
        seasonId: item.SeasonId || '',
        seriesId: item.SeriesId || '',
        episodeNumber: item.IndexNumber,
        seasonNumber: item.ParentIndexNumber,
        isAudio: false,
        isVideo: true,
        userData: item.UserData ? {
          playbackPositionTicks: item.UserData.PlaybackPositionTicks || 0,
          playCount: item.UserData.PlayCount || 0,
          unplayedItemCount: item.UserData.UnplayedItemCount || 0,
          played: item.UserData.Played || false,
        } : null,
      }
    })

    return NextResponse.json({ items, total: data.TotalRecordCount || items.length })
  } catch (err) {
    console.error('Failed to fetch next up items:', err)
    return NextResponse.json({ error: 'Failed to fetch next up items' }, { status: 500 })
  }
}
