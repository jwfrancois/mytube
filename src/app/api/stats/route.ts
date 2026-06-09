import { NextRequest, NextResponse } from 'next/server'

interface WatchHistoryItem {
  id: string
  title: string
  type: string
  genre: string
  watchedAt: string
  duration?: string
}

interface GenreBreakdown {
  genre: string
  count: number
  percentage: number
}

interface TypeBreakdown {
  type: string
  count: number
  percentage: number
}

interface DayActivity {
  day: string
  date: string
  count: number
}

interface MonthlyActivity {
  month: string
  count: number
}

interface StatsResponse {
  totalWatched: number
  genreBreakdown: GenreBreakdown[]
  typeBreakdown: TypeBreakdown[]
  topGenres: GenreBreakdown[]
  recentActivity: DayActivity[]
  watchStreak: number
  totalWatchTime: number
  favoriteDay: string
  peakHour: string
  monthlyActivity: MonthlyActivity[]
}

// Average durations in hours per type
const AVERAGE_DURATIONS: Record<string, number> = {
  MOVIE: 1.8,
  TV_SHOW: 0.42,
  MUSIC: 0.08,
  PODCAST: 0.5,
  AUDIOBOOK: 0.75,
  COLLECTION: 1.5,
  RADIO: 0.25,
  JELLYFIN: 1.0,
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { history } = body as { history: WatchHistoryItem[] }

    if (!Array.isArray(history)) {
      return NextResponse.json({ error: 'history must be an array' }, { status: 400 })
    }

    const totalWatched = history.length

    // Genre breakdown
    const genreMap: Record<string, number> = {}
    history.forEach((item) => {
      const genre = item.genre || 'Other'
      genreMap[genre] = (genreMap[genre] || 0) + 1
    })

    const genreBreakdown: GenreBreakdown[] = Object.entries(genreMap)
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: totalWatched > 0 ? Math.round((count / totalWatched) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Type breakdown
    const typeMap: Record<string, number> = {}
    history.forEach((item) => {
      const type = formatType(item.type)
      typeMap[type] = (typeMap[type] || 0) + 1
    })

    const typeBreakdown: TypeBreakdown[] = Object.entries(typeMap)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalWatched > 0 ? Math.round((count / totalWatched) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Top 5 genres
    const topGenres = genreBreakdown.slice(0, 5)

    // Recent activity (last 7 days)
    const recentActivity = computeRecentActivity(history)

    // Watch streak (consecutive days watching)
    const watchStreak = computeWatchStreak(history)

    // Total watch time (estimated hours)
    const totalWatchTime = Math.round(
      history.reduce((sum, item) => {
        const avg = AVERAGE_DURATIONS[item.type] || 0.5
        return sum + avg
      }, 0) * 10
    ) / 10

    // Favorite day of week
    const favoriteDay = computeFavoriteDay(history)

    // Peak hour of day
    const peakHour = computePeakHour(history)

    // Monthly activity (last 6 months)
    const monthlyActivity = computeMonthlyActivity(history)

    const stats: StatsResponse = {
      totalWatched,
      genreBreakdown,
      typeBreakdown,
      topGenres,
      recentActivity,
      watchStreak,
      totalWatchTime,
      favoriteDay,
      peakHour,
      monthlyActivity,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 })
  }
}

function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    MOVIE: 'Movie',
    TV_SHOW: 'TV Show',
    MUSIC: 'Music',
    PODCAST: 'Podcast',
    AUDIOBOOK: 'Audiobook',
    COLLECTION: 'Collection',
    RADIO: 'Radio',
    JELLYFIN: 'Jellyfin',
  }
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

function computeRecentActivity(history: WatchHistoryItem[]): DayActivity[] {
  const result: DayActivity[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayName = DAY_NAMES[date.getDay()].slice(0, 3)

    const count = history.filter((item) => {
      if (!item.watchedAt) return false
      const watchedDate = new Date(item.watchedAt).toISOString().split('T')[0]
      return watchedDate === dateStr
    }).length

    result.push({
      day: dayName,
      date: dateStr,
      count,
    })
  }

  return result
}

function computeWatchStreak(history: WatchHistoryItem[]): number {
  if (history.length === 0) return 0

  // Get unique dates from watch history
  const watchedDates = new Set<string>()
  history.forEach((item) => {
    if (item.watchedAt) {
      watchedDates.add(new Date(item.watchedAt).toISOString().split('T')[0])
    }
  })

  if (watchedDates.size === 0) return 0

  let streak = 0
  const today = new Date()

  // Start from today and go backwards
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    if (watchedDates.has(dateStr)) {
      streak++
    } else {
      // If today has no watches, allow starting from yesterday
      if (i === 0) continue
      break
    }
  }

  return streak
}

function computeFavoriteDay(history: WatchHistoryItem[]): string {
  const dayMap: Record<string, number> = {}
  DAY_NAMES.forEach((d) => (dayMap[d] = 0))

  history.forEach((item) => {
    if (item.watchedAt) {
      const dayName = DAY_NAMES[new Date(item.watchedAt).getDay()]
      dayMap[dayName] = (dayMap[dayName] || 0) + 1
    }
  })

  const entries = Object.entries(dayMap)
  if (entries.length === 0) return 'N/A'

  const [favorite] = entries.reduce((max, current) => (current[1] > max[1] ? current : max), entries[0])
  return favorite
}

function computePeakHour(history: WatchHistoryItem[]): string {
  const hourMap: Record<number, number> = {}

  history.forEach((item) => {
    if (item.watchedAt) {
      const hour = new Date(item.watchedAt).getHours()
      hourMap[hour] = (hourMap[hour] || 0) + 1
    }
  })

  const entries = Object.entries(hourMap)
  if (entries.length === 0) return 'N/A'

  const [peakHour] = entries.reduce((max, current) => (Number(current[1]) > Number(max[1]) ? current : max), entries[0])
  const hour = Number(peakHour)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour} ${ampm}`
}

function computeMonthlyActivity(history: WatchHistoryItem[]): MonthlyActivity[] {
  const result: MonthlyActivity[] = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth()
    const monthLabel = `${MONTH_NAMES[month]} ${year}`

    const count = history.filter((item) => {
      if (!item.watchedAt) return false
      const watchedDate = new Date(item.watchedAt)
      return watchedDate.getFullYear() === year && watchedDate.getMonth() === month
    }).length

    result.push({
      month: monthLabel,
      count,
    })
  }

  return result
}
