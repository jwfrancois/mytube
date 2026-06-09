import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    // Use Jellyfin's Shows/{SeriesId}/Seasons endpoint for proper season listing
    const url = `${server.serverUrl}/Shows/${seriesId}/Seasons?UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,ChildCount,IndexNumber,ParentIndexNumber`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      // Fallback: try fetching items with ParentId
      return await fetchSeasonsFallback(server, seriesId)
    }

    const data = await res.json()

    const seasons = (data.Items || []).map((item: any) => {
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
        genre: (item.Genres || []).join(', ') || '',
        thumbnail: item.ImageTags?.Primary
          ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
          : '',
        videoUrl: '',
        duration,
        releaseYear: item.ProductionYear || 0,
        artist: '',
        views: 0,
        channel: '',
        isJellyfin: true,
        jellyfinId: item.Id,
        itemType: item.Type || 'Season',
        parentId: item.ParentId || seriesId,
        hasChildren: true,
        childCount: item.ChildCount || 0,
        communityRating: item.CommunityRating,
        indexNumber: item.IndexNumber,
        parentIndexNumber: item.ParentIndexNumber,
        libraryName: '',
        mediaType: 'video',
      }
    })

    return NextResponse.json({ seasons })
  } catch (error) {
    console.error('Jellyfin seasons error:', error)
    // Return empty seasons instead of error to avoid breaking the UI
    return NextResponse.json({ seasons: [], error: 'Failed to fetch seasons: ' + (error instanceof Error ? error.message : String(error)) })
  }
}

// Fallback: fetch items with ParentId if the Shows endpoint doesn't work
async function fetchSeasonsFallback(
  server: { serverUrl: string; accessToken: string; userId: string },
  seriesId: string
) {
  try {
    const url = `${server.serverUrl}/Items?ParentId=${seriesId}&UserId=${server.userId}&IncludeItemTypes=Season&Recursive=false&Fields=PrimaryImageAspectRatio,Overview,ChildCount,IndexNumber,ParentIndexNumber&SortBy=SortName&SortOrder=Ascending`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ seasons: [] })
    }

    const data = await res.json()

    const seasons = (data.Items || []).map((item: any) => ({
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type: 'TV_SHOW',
      genre: '',
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration: '',
      releaseYear: 0,
      artist: '',
      views: 0,
      channel: '',
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: 'Season',
      parentId: seriesId,
      hasChildren: true,
      childCount: item.ChildCount || 0,
      indexNumber: item.IndexNumber,
      parentIndexNumber: item.ParentIndexNumber,
      libraryName: '',
      mediaType: 'video',
    }))

    return NextResponse.json({ seasons })
  } catch {
    return NextResponse.json({ seasons: [] })
  }
}
