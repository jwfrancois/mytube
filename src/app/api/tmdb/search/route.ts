import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MmJhMTBjNDM5MDY4MGIyNjY2NjU4MmU0NzE5MzQ0YyIsIm5iZiI6MTczMjg5NDcxOC40NzMsInN1YiI6IjY3NDkzZjRlMzRkMDJjNTFlMjVmNTVlOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.XKdGFRzEdZVnGZfQ0Vz2S4OO9xXrTQ8Lw1CFNBz2l04'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

const headers = {
  Authorization: `Bearer ${TMDB_API_KEY}`,
  'Content-Type': 'application/json',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const type = searchParams.get('type') || 'MOVIE'

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    const searchType = type === 'TV_SHOW' ? 'tv' : 'movie'

    // Step 1: Search for the title
    const searchUrl = `${TMDB_BASE}/search/${searchType}?query=${encodeURIComponent(query)}&page=1`
    const searchRes = await fetch(searchUrl, { headers })

    if (!searchRes.ok) {
      // Return graceful null instead of error so frontend handles it smoothly
      return NextResponse.json({ results: null, message: 'TMDB search unavailable' })
    }

    const searchData = await searchRes.json()
    const firstResult = searchData.results?.[0]

    if (!firstResult) {
      return NextResponse.json({ results: null, message: 'No results found' })
    }

    const tmdbId = firstResult.id

    // Step 2: Get detailed info (with credits)
    const detailUrl = `${TMDB_BASE}/${searchType}/${tmdbId}?append_to_response=credits,similar,recommendations`
    const detailRes = await fetch(detailUrl, { headers })

    if (!detailRes.ok) {
      return NextResponse.json({ results: null, message: 'TMDB detail unavailable' })
    }

    const detailData = await detailRes.json()

    // Extract cast (up to 10)
    const cast = (detailData.credits?.cast || []).slice(0, 10).map((person: any) => ({
      id: person.id,
      name: person.name,
      character: person.character || '',
      profilePath: person.profile_path ? `${TMDB_IMAGE_BASE}${person.profile_path}` : null,
    }))

    // Extract genres
    const genres = (detailData.genres || []).map((g: any) => ({
      id: g.id,
      name: g.name,
    }))

    // Extract ratings
    const communityRating = detailData.vote_average || null
    const voteCount = detailData.vote_count || 0

    // Extract similar/recommended titles
    const similar = (detailData.similar?.results || []).slice(0, 8).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      overview: item.overview || '',
      posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE}${item.backdrop_path}` : null,
      rating: item.vote_average || null,
      releaseDate: item.release_date || item.first_air_date || '',
      genreIds: item.genre_ids || [],
    }))

    const recommendations = (detailData.recommendations?.results || []).slice(0, 8).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      overview: item.overview || '',
      posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE}${item.backdrop_path}` : null,
      rating: item.vote_average || null,
      releaseDate: item.release_date || item.first_air_date || '',
      genreIds: item.genre_ids || [],
    }))

    // For TV shows, extract seasons info
    const seasons = type === 'TV_SHOW'
      ? (detailData.seasons || []).map((s: any) => ({
          id: s.id,
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          overview: s.overview || '',
          posterPath: s.poster_path ? `${TMDB_IMAGE_BASE}${s.poster_path}` : null,
          airDate: s.air_date || '',
        }))
      : []

    return NextResponse.json({
      results: {
        tmdbId,
        title: detailData.title || detailData.name,
        overview: detailData.overview || '',
        tagline: detailData.tagline || '',
        cast,
        genres,
        communityRating,
        voteCount,
        posterPath: detailData.poster_path ? `${TMDB_IMAGE_BASE}${detailData.poster_path}` : null,
        backdropPath: detailData.backdrop_path ? `${TMDB_IMAGE_BASE}${detailData.backdrop_path}` : null,
        similar,
        recommendations,
        seasons,
        numberOfSeasons: detailData.number_of_seasons || 0,
        numberOfEpisodes: detailData.number_of_episodes || 0,
        firstAirDate: detailData.first_air_date || '',
        releaseDate: detailData.release_date || '',
        status: detailData.status || '',
        productionCompanies: (detailData.production_companies || []).map((c: any) => c.name),
      },
    })
  } catch (error) {
    console.error('TMDB search error:', error)
    return NextResponse.json({ error: 'Internal server error', results: null }, { status: 500 })
  }
}
