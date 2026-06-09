import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/collections
 *
 * Returns all Jellyfin BoxSets (movie collections) from the server.
 * These are groups of related movies (sequels, franchises).
 */
export async function GET() {
  try {
    let server: Awaited<ReturnType<typeof db.jellyfinServer.findFirst>> = null
    try {
      server = await db.jellyfinServer.findFirst()
    } catch (dbError) {
      console.error('DB error (non-fatal):', dbError)
    }
    if (!server?.connected) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const url = `${server.serverUrl}/Items?UserId=${server.userId}&IncludeItemTypes=BoxSet&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,ChildCount&SortBy=SortName&SortOrder=Ascending&Limit=100`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const data = await res.json()
    const items = (data.Items || []).map((item: any) => ({
      id: `jf-${item.Id}`,
      title: item.Name || 'Untitled',
      description: item.Overview || '',
      type: 'COLLECTION',
      genre: (item.Genres || []).join(', '),
      thumbnail: item.ImageTags?.Primary
        ? `/api/jellyfin/image/${item.Id}?tag=${item.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration: '',
      releaseYear: item.ProductionYear || 0,
      artist: '',
      views: 0,
      channel: server.name,
      isJellyfin: true,
      jellyfinId: item.Id,
      itemType: item.Type,
      parentId: item.ParentId,
      hasChildren: true,
      childCount: item.ChildCount || 0,
      communityRating: item.CommunityRating,
    }))

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('Error fetching Jellyfin collections:', error)
    return NextResponse.json({ items: [], total: 0 })
  }
}
