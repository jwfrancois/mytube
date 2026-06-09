'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { useWatchHistory } from '@/hooks/useWatchHistory'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import {
  Sparkles,
  RefreshCw,
  Gem,
  Heart,
  Calendar,
  Star,
  Play,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface EnrichedPick {
  category: string
  reason: string
  item: MediaItem
}

interface DailyAIPicksProps {
  onPlay: (item: MediaItem) => void
}

// --- Category Config ---

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType
  label: string
  badgeColor: string
  glowColor: string
  gradientFrom: string
  gradientTo: string
}> = {
  "Today's Pick": {
    icon: Star,
    label: "Today's Pick",
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    glowColor: 'shadow-amber-500/20',
    gradientFrom: 'from-amber-500/12',
    gradientTo: 'to-amber-600/8',
  },
  'Hidden Gem': {
    icon: Gem,
    label: 'Hidden Gem',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    glowColor: 'shadow-emerald-500/15',
    gradientFrom: 'from-emerald-500/12',
    gradientTo: 'to-emerald-600/8',
  },
  'Mood Match': {
    icon: Heart,
    label: 'Mood Match',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
    glowColor: 'shadow-rose-500/15',
    gradientFrom: 'from-rose-500/12',
    gradientTo: 'to-rose-600/8',
  },
  'Weekend Binge': {
    icon: Calendar,
    label: 'Weekend Binge',
    badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
    glowColor: 'shadow-orange-500/15',
    gradientFrom: 'from-orange-500/12',
    gradientTo: 'to-orange-600/8',
  },
}

// --- Main Component ---

export function DailyAIPicks({ onPlay }: DailyAIPicksProps) {
  const mediaItems = useAppStore((s) => s.mediaItems)
  const { watchHistory } = useWatchHistory()

  const [picks, setPicks] = useState<EnrichedPick[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchPicks = useCallback(async () => {
    if (mediaItems.length === 0) return

    setIsLoading(true)
    setError(null)
    setHasLoaded(true)

    try {
      const history = watchHistory.map((h) => ({
        title: h.title,
        type: h.type,
        genre: h.genre,
      }))

      const res = await fetch('/api/ai/daily-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          mediaItems,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to get daily picks')
      }

      const data = await res.json()
      setPicks(data.picks || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setPicks([])
    } finally {
      setIsLoading(false)
    }
  }, [mediaItems, watchHistory])

  // Auto-load on mount when media items are available
  useEffect(() => {
    if (mediaItems.length > 0 && !hasLoaded) {
      fetchPicks()
    }
  }, [mediaItems.length, hasLoaded, fetchPicks])

  const handleRefresh = useCallback(() => {
    fetchPicks()
  }, [fetchPicks])

  // Find the featured pick (Today's Pick) and secondary picks
  const featuredPick = picks.find((p) => p.category === "Today's Pick")
  const secondaryPicks = picks.filter((p) => p.category !== "Today's Pick")

  return (
    <div className="px-6 mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/15">
            <Sparkles className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              ✨ Daily AI Picks
            </h2>
            <p className="text-[11px] text-muted-foreground/60">Personalized for you</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "gap-1.5 text-xs",
            "text-amber-300 hover:text-amber-200 hover:bg-amber-500/10",
            "disabled:opacity-40"
          )}
        >
          {isLoading ? (
            <div className="h-3.5 w-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh Picks
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && picks.length === 0 && (
        <div className="space-y-4">
          {/* Featured skeleton */}
          <div className="relative overflow-hidden rounded-2xl">
            <Skeleton className="w-full h-[220px] sm:h-[260px] rounded-2xl shimmer" />
          </div>
          {/* Secondary skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl shimmer" />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Picks Content */}
      {!isLoading && !error && picks.length > 0 && (
        <div className="space-y-4">
          {/* Featured Pick — Today's Pick */}
          {featuredPick && (
            <FeaturedPickCard pick={featuredPick} onPlay={onPlay} />
          )}

          {/* Secondary Picks */}
          {secondaryPicks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondaryPicks.map((pick, idx) => (
                <SecondaryPickCard key={`${pick.item.id}-${idx}`} pick={pick} onPlay={onPlay} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Picks / Empty State */}
      {!isLoading && !error && hasLoaded && picks.length === 0 && (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">
            No picks available. Add some media to your library to get personalized recommendations.
          </p>
        </div>
      )}

      {/* Initial State — not yet loaded */}
      {!isLoading && !error && !hasLoaded && (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">
            Your daily AI picks will appear here once your library is loaded.
          </p>
        </div>
      )}
    </div>
  )
}

// --- Featured Pick Card ---

function FeaturedPickCard({ pick, onPlay }: { pick: EnrichedPick; onPlay: (item: MediaItem) => void }) {
  const config = CATEGORY_CONFIG[pick.category] || CATEGORY_CONFIG["Today's Pick"]
  const Icon = config.icon

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl cursor-pointer group",
        "bg-gradient-to-br",
        config.gradientFrom,
        config.gradientTo,
        "border border-amber-500/20",
        "shadow-lg",
        config.glowColor,
        "hover:shadow-xl transition-all duration-300",
        "hover:border-amber-500/30"
      )}
      onClick={() => onPlay(pick.item)}
    >
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-600/6 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10 flex flex-col sm:flex-row gap-0 sm:gap-5 p-5 sm:p-6">
        {/* Thumbnail */}
        <div className="relative w-full sm:w-[280px] lg:w-[340px] aspect-video sm:aspect-video rounded-xl overflow-hidden bg-muted shrink-0">
          {pick.item.thumbnail ? (
            <img
              src={pick.item.thumbnail}
              alt={pick.item.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-900/30 to-amber-800/10">
              <Icon className="h-12 w-12 text-amber-500/30" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/25 shadow-lg shadow-black/20 scale-90 group-hover:scale-100 transition-transform duration-300">
              <Play className="h-6 w-6 text-white fill-white ml-1" />
            </div>
          </div>

          {/* Category badge on thumbnail */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="outline"
              className={cn("text-xs px-2.5 py-0.5 gap-1.5 font-semibold backdrop-blur-md", config.badgeColor)}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center pt-4 sm:pt-0 sm:pl-1 min-w-0">
          <h3 className="text-xl sm:text-2xl font-bold text-white/95 leading-tight mb-2 line-clamp-2 group-hover:text-amber-100 transition-colors">
            {pick.item.title}
          </h3>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70 mb-3">
            {pick.item.releaseYear > 0 && <span>{pick.item.releaseYear}</span>}
            {pick.item.genre && (
              <>
                {pick.item.releaseYear > 0 && <span className="text-muted-foreground/30">•</span>}
                <span>{pick.item.genre}</span>
              </>
            )}
            {pick.item.artist && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span>{pick.item.artist}</span>
              </>
            )}
          </div>

          {/* AI Reason */}
          <p className="text-sm italic text-muted-foreground/60 leading-relaxed mb-4 line-clamp-3">
            &ldquo;{pick.reason}&rdquo;
          </p>

          {/* Play button */}
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onPlay(pick.item)
            }}
            className={cn(
              "w-fit gap-2 font-semibold",
              "bg-gradient-to-r from-amber-500 to-amber-600",
              "hover:from-amber-600 hover:to-amber-700",
              "shadow-lg shadow-amber-500/20",
              "text-white",
              "transition-all duration-300"
            )}
          >
            <Play className="h-4 w-4 fill-white" />
            Play Now
          </Button>
        </div>
      </div>
    </Card>
  )
}

// --- Secondary Pick Card ---

function SecondaryPickCard({ pick, onPlay }: { pick: EnrichedPick; onPlay: (item: MediaItem) => void }) {
  const config = CATEGORY_CONFIG[pick.category] || CATEGORY_CONFIG['Hidden Gem']
  const Icon = config.icon

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl cursor-pointer group",
        "bg-gradient-to-br",
        config.gradientFrom,
        config.gradientTo,
        "border border-white/5",
        "hover:border-white/10",
        "hover:shadow-lg transition-all duration-300",
        `hover:${config.glowColor}`
      )}
      onClick={() => onPlay(pick.item)}
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/3 rounded-full blur-2xl -translate-y-1/3 translate-x-1/4" />

      <div className="relative z-10 p-4">
        {/* Category badge */}
        <Badge
          variant="outline"
          className={cn("text-[10px] px-2 py-0.5 gap-1 font-semibold mb-3", config.badgeColor)}
        >
          <Icon className="h-2.5 w-2.5" />
          {config.label}
        </Badge>

        {/* Title */}
        <h3 className="text-sm font-bold text-white/90 leading-snug mb-1.5 line-clamp-2 group-hover:text-white transition-colors">
          {pick.item.title}
        </h3>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/50 mb-2">
          {pick.item.releaseYear > 0 && <span>{pick.item.releaseYear}</span>}
          {pick.item.genre && (
            <>
              {pick.item.releaseYear > 0 && <span className="text-muted-foreground/30">•</span>}
              <span className="truncate max-w-[120px]">{pick.item.genre}</span>
            </>
          )}
        </div>

        {/* AI Reason */}
        <p className="text-[11px] italic text-muted-foreground/50 leading-relaxed line-clamp-2 mb-3">
          &ldquo;{pick.reason}&rdquo;
        </p>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onPlay(pick.item)
            }}
            className={cn(
              "h-7 px-3 gap-1.5 text-xs font-medium",
              "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Play className="h-3 w-3 fill-current" />
            Play
          </Button>
          <span className="text-[10px] text-muted-foreground/40 truncate">
            {pick.item.artist || pick.item.channel || pick.item.type}
          </span>
        </div>
      </div>
    </Card>
  )
}
