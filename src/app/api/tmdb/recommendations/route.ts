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
    const tmdbId = searchParams.get('tmdbId')
    const type = searchParams.get('type') || 'MOVIE'

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId parameter is required' }, { status: 400 })
    }

    const searchType = type === 'TV_SHOW' ? 'tv' : 'movie'

    const url = `${TMDB_BASE}/${searchType}/${tmdbId}/recommendations?page=1`
    const res = await fetch(url, { headers })

    if (!res.ok) {
      return NextResponse.json({ recommendations: [], message: 'TMDB recommendations unavailable' })
    }

    const data = await res.json()

    const recommendations = (data.results || []).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      overview: item.overview || '',
      posterPath: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE}${item.backdrop_path}` : null,
      rating: item.vote_average || null,
      releaseDate: item.release_date || item.first_air_date || '',
      genreIds: item.genre_ids || [],
    }))

    return NextResponse.json({ recommendations, totalPages: data.total_pages || 1 })
  } catch (error) {
    console.error('TMDB recommendations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
