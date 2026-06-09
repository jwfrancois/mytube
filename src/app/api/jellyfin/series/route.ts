import { fetchSeriesSeasons, fetchSeasonEpisodes } from '@/lib/jellyfin-cache'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/jellyfin/series?seriesId=xxx
 * Fetch seasons for a series.
 * GET /api/jellyfin/series?seasonId=xxx
 * Fetch episodes for a season.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const seriesId = searchParams.get('seriesId')
    const seasonId = searchParams.get('seasonId')

    if (seasonId) {
      const episodes = await fetchSeasonEpisodes(seasonId)
      return NextResponse.json({ episodes })
    }

    if (seriesId) {
      const seasons = await fetchSeriesSeasons(seriesId)
      return NextResponse.json({ seasons })
    }

    return NextResponse.json({ error: 'seriesId or seasonId required' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching series data:', error)
    return NextResponse.json({ error: 'Failed to fetch series data' }, { status: 500 })
  }
}
