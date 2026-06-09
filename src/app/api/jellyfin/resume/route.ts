import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'
import { NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/resume
 * Returns items that the user has started watching but not finished (Continue Watching).
 */
export async function GET() {
  try {
    const server = await getJellyfinCredentials()
    if (!server) {
      return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
    }

    const fields = 'PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount,MediaSources,BackdropImageTags'
    const url = `${server.serverUrl}/Users/${server.userId}/Items/Resume?Limit=20&Fields=${fields}&MediaTypes=Video,Audio&ImageTypeLimit=1`

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

    const items = (data.Items || []).map((item: any) => mapItem(item, server.name))

    return NextResponse.json({ items, total: data.TotalRecordCount || items.length })
  } catch (err) {
    console.error('Failed to fetch resume items:', err)
    return NextResponse.json({ error: 'Failed to fetch resume items' }, { status: 500 })
  }
}

function mapItem(item: any, serverName: string) {
  let type = 'MOVIE'
  if (item.Type === 'Series') type = 'TV_SHOW'
  else if (item.Type === 'Episode') type = 'TV_SHOW'
  else if (item.Type === 'Audio' || item.Type === 'MusicAlbum') type = 'MUSIC'
  else if (item.Type === 'AudioBook') type = 'AUDIOBOOK'

  const hasChildren = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'MusicAlbum' || item.Type === 'BoxSet' || item.IsFolder

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
    type,
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
    artist: item.AlbumArtist || item.Artists?.[0] || item.Studios?.[0]?.Name || '',
    views: 0,
    channel: item.OfficialRating || serverName,
    createdAt: item.DateCreated || new Date().toISOString(),
    isJellyfin: true,
    jellyfinId: item.Id,
    itemType: item.Type,
    parentId: item.ParentId,
    hasChildren,
    childCount: item.ChildCount || 0,
    communityRating: item.CommunityRating,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    seriesName: item.SeriesName || '',
    seasonId: item.SeasonId || '',
    seriesId: item.SeriesId || '',
    episodeNumber: item.IndexNumber,
    seasonNumber: item.ParentIndexNumber,
    isAudio: ['Audio', 'AudioBook', 'MusicAlbum'].includes(item.Type),
    isVideo: ['Movie', 'Episode', 'Video'].includes(item.Type),
    // Resume-specific
    userData: item.UserData ? {
      playbackPositionTicks: item.UserData.PlaybackPositionTicks || 0,
      playCount: item.UserData.PlayCount || 0,
      playedPercentage: item.UserData.PlayedPercentage || 0,
      unplayedItemCount: item.UserData.UnplayedItemCount || 0,
      played: item.UserData.Played || false,
    } : null,
  }
}
