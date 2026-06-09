'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWatchHistory } from '@/hooks/useWatchHistory'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Clock,
  Flame,
  Eye,
  TrendingUp,
  Calendar,
  Zap,
  ArrowLeft,
  Sparkles,
  Film,
  Tv,
  Music,
  Headphones,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────

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

interface StatsData {
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

// ─── Color Palette for Charts ─────────────────────────────────────

const GENRE_COLORS = [
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-purple-500',
  'from-cyan-500 to-sky-500',
  'from-lime-500 to-green-500',
  'from-fuchsia-500 to-pink-500',
  'from-yellow-500 to-amber-500',
]

const TYPE_COLORS: Record<string, string> = {
  Movie: '#ef4444',
  'TV Show': '#10b981',
  Music: '#a855f7',
  Podcast: '#f59e0b',
  Audiobook: '#06b6d4',
  Collection: '#f97316',
  Radio: '#ec4899',
  Jellyfin: '#64748b',
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  Movie: Film,
  'TV Show': Tv,
  Music: Music,
  Podcast: Headphones,
  Audiobook: Headphones,
  Collection: BarChart3,
  Radio: Zap,
  Jellyfin: BarChart3,
}

// ─── Component ────────────────────────────────────────────────────

interface StatsDashboardProps {
  onClose?: () => void
}

export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const { watchHistory } = useWatchHistory()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [insight, setInsight] = useState<string>('')

  // Fetch stats from API
  useEffect(() => {
    if (watchHistory.length === 0) {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: watchHistory }),
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [watchHistory])

  // Generate a fun insight based on stats
  useEffect(() => {
    if (!stats) return

    const insights: string[] = []

    if (stats.watchStreak >= 7) {
      insights.push(`🔥 ${stats.watchStreak}-day streak! You're on fire — consistency is key!`)
    } else if (stats.watchStreak >= 3) {
      insights.push(`⚡ ${stats.watchStreak}-day streak — keep it going!`)
    }

    if (stats.topGenres.length > 0) {
      const topGenre = stats.topGenres[0]
      insights.push(`🎭 ${topGenre.genre} is your vibe — ${topGenre.percentage}% of your watchlist!`)
    }

    if (stats.favoriteDay !== 'N/A' && stats.favoriteDay !== 'Sunday') {
      insights.push(`📅 ${stats.favoriteDay}s are your prime binge days!`)
    }

    if (stats.peakHour !== 'N/A') {
      insights.push(`🌙 Peak viewing at ${stats.peakHour} — night owl or early bird?`)
    }

    if (stats.totalWatchTime > 50) {
      insights.push(`🎬 ${stats.totalWatchTime} hours watched — that's like bingeing ${Math.round(stats.totalWatchTime / 2)} movies!`)
    }

    if (stats.typeBreakdown.length > 1) {
      const topType = stats.typeBreakdown[0]
      insights.push(`💡 You're a ${topType.type} aficionado with ${topType.count} ${topType.type.toLowerCase()}s watched!`)
    }

    if (insights.length === 0) {
      insights.push('✨ Start watching more to unlock personalized insights!')
    }

    setInsight(insights[Math.floor(Math.random() * insights.length)])
  }, [stats])

  // Compute donut chart conic-gradient
  const donutGradient = useMemo(() => {
    if (!stats || stats.typeBreakdown.length === 0) return 'conic-gradient(#1e293b 0% 100%)'

    let cumulative = 0
    const stops: string[] = []

    stats.typeBreakdown.forEach((item) => {
      const color = TYPE_COLORS[item.type] || '#64748b'
      const start = cumulative
      cumulative += item.percentage
      stops.push(`${color} ${start}% ${cumulative}%`)
    })

    // Fill the remainder
    if (cumulative < 100) {
      stops.push(`#1e293b ${cumulative}% 100%`)
    }

    return `conic-gradient(${stops.join(', ')})`
  }, [stats])

  // Max count for chart scaling
  const maxRecentCount = useMemo(() => {
    if (!stats) return 1
    return Math.max(...stats.recentActivity.map((d) => d.count), 1)
  }, [stats])

  const maxMonthlyCount = useMemo(() => {
    if (!stats) return 1
    return Math.max(...stats.monthlyActivity.map((m) => m.count), 1)
  }, [stats])

  // ─── Loading State ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  // ─── Empty State ──────────────────────────────────────────────

  if (!stats || stats.totalWatched === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Stats Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Start watching movies, shows, or music to see your personal analytics dashboard come to life!
        </p>
      </div>
    )
  }

  // ─── Main Dashboard ──────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            <span className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 bg-clip-text text-transparent">
              Your Watch Stats
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalized analytics from your watch history
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <QuickStatCard
          icon={Eye}
          label="Total Watched"
          value={stats.totalWatched}
          gradient="from-emerald-500/20 to-emerald-600/5"
          iconColor="text-emerald-400"
          borderColor="border-emerald-500/20"
        />
        <QuickStatCard
          icon={Flame}
          label="Watch Streak"
          value={`${stats.watchStreak}d`}
          gradient="from-amber-500/20 to-amber-600/5"
          iconColor="text-amber-400"
          borderColor="border-amber-500/20"
        />
        <QuickStatCard
          icon={Clock}
          label="Est. Hours"
          value={stats.totalWatchTime}
          gradient="from-rose-500/20 to-rose-600/5"
          iconColor="text-rose-400"
          borderColor="border-rose-500/20"
        />
        <QuickStatCard
          icon={Zap}
          label="Peak Hour"
          value={stats.peakHour}
          gradient="from-violet-500/20 to-violet-600/5"
          iconColor="text-violet-400"
          borderColor="border-violet-500/20"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Genre Breakdown - Horizontal Bar Chart */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Top Genres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topGenres.map((genre, i) => (
              <div key={genre.genre} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{genre.genre}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 border-white/10"
                    >
                      {genre.count}
                    </Badge>
                    <span className="text-muted-foreground text-xs w-8 text-right">
                      {genre.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
                      GENRE_COLORS[i % GENRE_COLORS.length]
                    )}
                    style={{ width: `${Math.max(genre.percentage, 2)}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.topGenres.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No genre data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Type Distribution - CSS Donut Chart */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Content Type Mix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut Chart */}
              <div className="relative shrink-0">
                <div
                  className="h-36 w-36 md:h-40 md:w-40 rounded-full"
                  style={{ background: donutGradient }}
                >
                  <div className="absolute inset-4 md:inset-5 rounded-full bg-card flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{stats.totalWatched}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Total
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2 w-full">
                {stats.typeBreakdown.map((item) => {
                  const IconComp = TYPE_ICONS[item.type] || BarChart3
                  const color = TYPE_COLORS[item.type] || '#64748b'
                  return (
                    <div
                      key={item.type}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <IconComp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{item.type}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {item.percentage}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Activity Bar Chart */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-rose-400" />
              Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-36 md:h-44">
              {stats.recentActivity.map((day) => {
                const heightPercent = maxRecentCount > 0
                  ? Math.max((day.count / maxRecentCount) * 100, day.count > 0 ? 8 : 2)
                  : 2
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className={cn(
                          'w-full max-w-[36px] rounded-t-md transition-all duration-500 ease-out',
                          day.count > 0
                            ? 'bg-gradient-to-t from-rose-500 to-rose-400'
                            : 'bg-muted/20'
                        )}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {day.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Activity Bar Chart */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              6-Month Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-36 md:h-44">
              {stats.monthlyActivity.map((month) => {
                const heightPercent = maxMonthlyCount > 0
                  ? Math.max((month.count / maxMonthlyCount) * 100, month.count > 0 ? 8 : 2)
                  : 2
                return (
                  <div
                    key={month.month}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {month.count > 0 ? month.count : ''}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className={cn(
                          'w-full max-w-[36px] rounded-t-md transition-all duration-500 ease-out',
                          month.count > 0
                            ? 'bg-gradient-to-t from-violet-500 to-violet-400'
                            : 'bg-muted/20'
                        )}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium truncate w-full text-center">
                      {month.month.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fun Insights + Extra Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fun Insight */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-amber-500/10 to-rose-500/10 backdrop-blur-sm border-white/10 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Fun Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm md:text-base leading-relaxed">{insight}</p>
          </CardContent>
        </Card>

        {/* Quick Facts */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-cyan-400" />
              Quick Facts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Favorite Day</span>
              <Badge variant="outline" className="text-xs border-white/10">
                {stats.favoriteDay}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Peak Hour</span>
              <Badge variant="outline" className="text-xs border-white/10">
                {stats.peakHour}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Genres Explored</span>
              <Badge variant="outline" className="text-xs border-white/10">
                {stats.genreBreakdown.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Content Types</span>
              <Badge variant="outline" className="text-xs border-white/10">
                {stats.typeBreakdown.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Genre Breakdown */}
      {stats.genreBreakdown.length > 5 && (
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              All Genres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {stats.genreBreakdown.map((genre, i) => (
                <div key={genre.genre} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{genre.genre}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-muted-foreground text-xs">
                        {genre.count} · {genre.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
                        GENRE_COLORS[i % GENRE_COLORS.length]
                      )}
                      style={{ width: `${Math.max(genre.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Quick Stat Card Sub-component ────────────────────────────────

interface QuickStatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  gradient: string
  iconColor: string
  borderColor: string
}

function QuickStatCard({ icon: Icon, label, value, gradient, iconColor, borderColor }: QuickStatCardProps) {
  return (
    <Card className={cn('bg-gradient-to-br backdrop-blur-sm', gradient, borderColor)}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
