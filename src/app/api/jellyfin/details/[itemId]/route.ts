import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    // Fetch item details with People
    const detailUrl = `${server.serverUrl}/Items?Ids=${itemId}&UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,OfficialRating,MediaSources,ChildCount,People`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const detailRes = await fetch(detailUrl, {
      headers: {
        'X-Emby-Token': server.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!detailRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch item details' }, { status: detailRes.status })
    }

    const detailData = await detailRes.json()
    const item = detailData.Items?.[0]

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Build base response
    const result: any = {
      id: item.Id,
      name: item.Name || 'Untitled',
      overview: item.Overview || '',
      type: item.Type,
      genres: item.Genres || [],
      studios: (item.Studios || []).map((s: any) => s.Name),
      communityRating: item.CommunityRating || null,
      officialRating: item.OfficialRating || '',
      productionYear: item.ProductionYear || null,
      runTimeTicks: item.RunTimeTicks || null,
      childCount: item.ChildCount || 0,
      people: [],
      seasons: [],
      episodes: [],
      imageTags: item.ImageTags || {},
    }

    // Extract cast/people
    const people = item.People || []
    result.people = people.map((p: any, index: number) => ({
      id: p.Id || `person-${index}`,
      name: p.Name || '',
      role: p.Role || '',
      type: p.Type || '',
      primaryImageTag: p.PrimaryImageTag || '',
      thumbnail: p.Id && p.PrimaryImageTag
        ? `/api/jellyfin/image/${p.Id}?tag=${p.PrimaryImageTag}`
        : '',
    }))

    // For Series type, fetch seasons
    if (item.Type === 'Series') {
      try {
        const seasonsUrl = `${server.serverUrl}/Shows/${itemId}/Seasons?UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,ChildCount`
        const seasonsController = new AbortController()
        const seasonsTimeout = setTimeout(() => seasonsController.abort(), 10000)

        const seasonsRes = await fetch(seasonsUrl, {
          headers: {
            'X-Emby-Token': server.accessToken,
          },
          signal: seasonsController.signal,
        })

        clearTimeout(seasonsTimeout)

        if (seasonsRes.ok) {
          const seasonsData = await seasonsRes.json()
          result.seasons = (seasonsData.Items || []).map((s: any) => ({
            id: s.Id,
            name: s.Name || '',
            indexNumber: s.IndexNumber || 0,
            episodeCount: s.ChildCount || s.EpisodeCount || 0,
            overview: s.Overview || '',
            thumbnail: s.ImageTags?.Primary
              ? `/api/jellyfin/image/${s.Id}?tag=${s.ImageTags.Primary}`
              : '',
          }))

          // Fetch episodes for the first season by default (or the specified season)
          const targetSeasonId = seasonId || (result.seasons.length > 0 ? result.seasons[0].id : null)
          if (targetSeasonId) {
            const episodesUrl = `${server.serverUrl}/Shows/${itemId}/Episodes?SeasonId=${targetSeasonId}&UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview,MediaSources`
            const episodesController = new AbortController()
            const episodesTimeout = setTimeout(() => episodesController.abort(), 10000)

            const episodesRes = await fetch(episodesUrl, {
              headers: {
                'X-Emby-Token': server.accessToken,
              },
              signal: episodesController.signal,
            })

            clearTimeout(episodesTimeout)

            if (episodesRes.ok) {
              const episodesData = await episodesRes.json()
              result.episodes = (episodesData.Items || []).map((e: any) => {
                let duration = ''
                if (e.RunTimeTicks) {
                  const totalMinutes = Math.floor(e.RunTimeTicks / 600000000)
                  const hours = Math.floor(totalMinutes / 60)
                  const minutes = totalMinutes % 60
                  duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
                }

                return {
                  id: e.Id,
                  name: e.Name || '',
                  indexNumber: e.IndexNumber || 0,
                  parentIndexNumber: e.ParentIndexNumber || 1,
                  overview: e.Overview || '',
                  duration,
                  runTimeTicks: e.RunTimeTicks || null,
                  thumbnail: e.ImageTags?.Primary
                    ? `/api/jellyfin/image/${e.Id}?tag=${e.ImageTags.Primary}`
                    : '',
                  mediaSourceId: e.MediaSources?.[0]?.Id || e.Id,
                  hasVideo: e.MediaType === 'Video',
                }
              })
            }
          }
        }
      } catch (err) {
        console.error('Error fetching seasons/episodes:', err)
        // Non-fatal — continue with empty seasons/episodes
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Jellyfin details error:', error)
    return NextResponse.json({ error: 'Failed to fetch item details' }, { status: 500 })
  }
}
