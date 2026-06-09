import { NextRequest, NextResponse } from 'next/server'
import {
  getTopStations,
  searchStations,
  getStationsByCountry,
  getStationsByTag,
  getCountries,
  getTags,
  clickStation,
  advancedSearch,
} from '@/lib/radio-browser'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'top'

  try {
    switch (action) {
      case 'top': {
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')
        const stations = await getTopStations(limit, offset)
        return NextResponse.json({ stations })
      }

      case 'search': {
        const query = searchParams.get('q') || ''
        if (!query.trim()) {
          return NextResponse.json({ error: 'Search query required' }, { status: 400 })
        }
        const limit = parseInt(searchParams.get('limit') || '50')
        const stations = await searchStations(query, limit)
        return NextResponse.json({ stations })
      }

      case 'country': {
        const code = searchParams.get('code') || ''
        if (!code) {
          return NextResponse.json({ error: 'Country code required' }, { status: 400 })
        }
        const limit = parseInt(searchParams.get('limit') || '100')
        const stations = await getStationsByCountry(code, limit)
        return NextResponse.json({ stations })
      }

      case 'genre':
      case 'tag': {
        const tag = searchParams.get('tag') || ''
        if (!tag) {
          return NextResponse.json({ error: 'Tag/genre required' }, { status: 400 })
        }
        const limit = parseInt(searchParams.get('limit') || '100')
        const stations = await getStationsByTag(tag, limit)
        return NextResponse.json({ stations })
      }

      case 'countries': {
        const countries = await getCountries()
        return NextResponse.json({ countries })
      }

      case 'tags':
      case 'genres': {
        const limit = parseInt(searchParams.get('limit') || '100')
        const tags = await getTags(limit)
        return NextResponse.json({ tags })
      }

      case 'advanced': {
        const stations = await advancedSearch({
          name: searchParams.get('name') || undefined,
          country: searchParams.get('country') || undefined,
          countryCode: searchParams.get('countryCode') || undefined,
          tag: searchParams.get('tag') || undefined,
          language: searchParams.get('language') || undefined,
          codec: searchParams.get('codec') || undefined,
          bitrateMin: searchParams.get('bitrateMin') ? parseInt(searchParams.get('bitrateMin')!) : undefined,
          bitrateMax: searchParams.get('bitrateMax') ? parseInt(searchParams.get('bitrateMax')!) : undefined,
          order: searchParams.get('order') || 'clickcount',
          limit: parseInt(searchParams.get('limit') || '50'),
          offset: parseInt(searchParams.get('offset') || '0'),
        })
        return NextResponse.json({ stations })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[/api/radio] Error:', err.message)
    return NextResponse.json(
      { error: 'Radio service unavailable', details: err.message },
      { status: 502 }
    )
  }
}

// Click tracking — increment station click count
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stationUuid } = body
    if (!stationUuid) {
      return NextResponse.json({ error: 'stationUuid required' }, { status: 400 })
    }
    await clickStation(stationUuid)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
