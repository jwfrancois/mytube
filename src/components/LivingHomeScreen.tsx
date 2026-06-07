'use client'

import { useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import { MediaItem } from '@/store/useAppStore'
import { MediaSection } from '@/components/MediaGrid'
import { Button } from '@/components/ui/button'
import { Sun, Sunrise, Sunset, Moon, Coffee, Brain, Film, Headphones, Newspaper, Music2, BookOpen, Tv, CloudMoon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ──────────────────────────────────────────────
// Time Context Types
// ──────────────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export interface TimeContextValue {
  greeting: string
  timeOfDay: TimeOfDay
  gradient: string
  icon: ReactNode
  description: string
}

// ──────────────────────────────────────────────
// Time Context Configuration
// ──────────────────────────────────────────────

interface TimeConfig {
  greeting: string
  description: string
  gradient: string
  iconBg: string
  icon: ReactNode
  chips: { label: string; icon: ReactNode; query: string }[]
  sectionPriority: string[]
}

const TIME_CONFIGS: Record<TimeOfDay, TimeConfig> = {
  morning: {
    greeting: 'Good Morning',
    description: "Here's what's perfect for your morning",
    gradient: 'from-amber-500/20 via-orange-400/15 to-rose-400/10',
    iconBg: 'from-amber-400 to-orange-500',
    icon: <Sunrise className="h-5 w-5 text-white" />,
    chips: [
      { label: 'Morning News', icon: <Newspaper className="h-3.5 w-3.5" />, query: 'morning news and current events' },
      { label: 'Wake Up Music', icon: <Music2 className="h-3.5 w-3.5" />, query: 'upbeat energizing music to start the day' },
      { label: 'Daily Podcasts', icon: <Headphones className="h-3.5 w-3.5" />, query: 'daily podcast episodes' },
    ],
    sectionPriority: ['jellyfin-podcasts', 'jellyfin-music', 'jellyfin-movies', 'jellyfin-tvshows', 'jellyfin-audiobooks'],
  },
  afternoon: {
    greeting: 'Good Afternoon',
    description: 'Stay focused and productive',
    gradient: 'from-cyan-500/15 via-teal-400/10 to-emerald-400/8',
    iconBg: 'from-cyan-400 to-teal-500',
    icon: <Sun className="h-5 w-5 text-white" />,
    chips: [
      { label: 'Focus Mode', icon: <Brain className="h-3.5 w-3.5" />, query: 'focus and concentration music' },
      { label: 'Study Music', icon: <Music2 className="h-3.5 w-3.5" />, query: 'ambient study music and lo-fi beats' },
      { label: 'Documentaries', icon: <Film className="h-3.5 w-3.5" />, query: 'documentaries and educational content' },
    ],
    sectionPriority: ['jellyfin-music', 'jellyfin-movies', 'jellyfin-podcasts', 'jellyfin-tvshows', 'jellyfin-audiobooks'],
  },
  evening: {
    greeting: 'Good Evening',
    description: 'Time to relax and enjoy',
    gradient: 'from-orange-500/15 via-rose-500/10 to-purple-500/10',
    iconBg: 'from-orange-400 to-rose-500',
    icon: <Sunset className="h-5 w-5 text-white" />,
    chips: [
      { label: 'Movie Night', icon: <Film className="h-3.5 w-3.5" />, query: 'popular movies for movie night' },
      { label: 'Family Picks', icon: <Tv className="h-3.5 w-3.5" />, query: 'family friendly movies and shows' },
      { label: 'Relax & Unwind', icon: <Coffee className="h-3.5 w-3.5" />, query: 'relaxing music and chill content' },
    ],
    sectionPriority: ['jellyfin-movies', 'jellyfin-tvshows', 'jellyfin-music', 'jellyfin-audiobooks', 'jellyfin-podcasts'],
  },
  night: {
    greeting: 'Good Night',
    description: 'Wind down with something soothing',
    gradient: 'from-purple-900/20 via-slate-800/15 to-gray-900/10',
    iconBg: 'from-purple-500 to-slate-700',
    icon: <Moon className="h-5 w-5 text-white" />,
    chips: [
      { label: 'Sleep Sounds', icon: <CloudMoon className="h-3.5 w-3.5" />, query: 'ambient sleep sounds and white noise' },
      { label: 'Late Night Jazz', icon: <Music2 className="h-3.5 w-3.5" />, query: 'late night jazz and smooth music' },
      { label: 'Chill Vibes', icon: <Headphones className="h-3.5 w-3.5" />, query: 'chill ambient music for late night' },
    ],
    sectionPriority: ['jellyfin-music', 'jellyfin-audiobooks', 'jellyfin-podcasts', 'jellyfin-tvshows', 'jellyfin-movies'],
  },
}

// ──────────────────────────────────────────────
// useTimeContext Hook (exported for reuse)
// ──────────────────────────────────────────────

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function useTimeContext(): TimeContextValue {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => {
    if (typeof window === 'undefined') return 'morning'
    return getTimeOfDay(new Date().getHours())
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = new Date()
      setTimeOfDay(getTimeOfDay(updated.getHours()))
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  const config = TIME_CONFIGS[timeOfDay]

  return useMemo(() => ({
    greeting: config.greeting,
    timeOfDay,
    gradient: config.gradient,
    icon: config.icon,
    description: config.description,
  }), [config, timeOfDay])
}

// ──────────────────────────────────────────────
// useTimeBasedSections Hook
// ──────────────────────────────────────────────

export function useTimeBasedSections(mediaItems: MediaItem[]): MediaSection[] {
  const { timeOfDay } = useTimeContext()

  return useMemo(() => {
    if (mediaItems.length === 0) return []

    const sections: MediaSection[] = []

    const movies = mediaItems.filter(i => i.isJellyfin && i.type === 'MOVIE')
    const tvShows = mediaItems.filter(i => i.isJellyfin && i.type === 'TV_SHOW')
    const music = mediaItems.filter(i => i.isJellyfin && i.type === 'MUSIC')
    const podcasts = mediaItems.filter(i => i.isJellyfin && i.type === 'PODCAST')
    const audiobooks = mediaItems.filter(i => i.isJellyfin && i.type === 'AUDIOBOOK')

    if (timeOfDay === 'morning') {
      if (podcasts.length > 0) {
        sections.push({
          id: 'time-morning-podcasts',
          title: 'Morning Podcasts',
          items: podcasts.slice(0, 20),
          icon: <Headphones className="h-5 w-5 text-amber-400" />,
        })
      }
      if (music.length > 0) {
        sections.push({
          id: 'time-morning-music',
          title: 'Wake Up Music',
          items: music.slice(0, 20),
          icon: <Music2 className="h-5 w-5 text-orange-400" />,
        })
      }
    } else if (timeOfDay === 'afternoon') {
      if (music.length > 0) {
        sections.push({
          id: 'time-afternoon-focus',
          title: 'Focus Playlists',
          items: music.slice(0, 20),
          icon: <Brain className="h-5 w-5 text-teal-400" />,
        })
      }
      if (movies.length > 0) {
        sections.push({
          id: 'time-afternoon-documentaries',
          title: 'Documentaries & Learning',
          items: movies.slice(0, 20),
          icon: <Film className="h-5 w-5 text-cyan-400" />,
        })
      }
    } else if (timeOfDay === 'evening') {
      if (movies.length > 0) {
        sections.push({
          id: 'time-evening-movies',
          title: 'Movie Night',
          items: movies.slice(0, 20),
          icon: <Film className="h-5 w-5 text-rose-400" />,
        })
      }
      if (tvShows.length > 0) {
        sections.push({
          id: 'time-evening-tv',
          title: 'Evening Shows',
          items: tvShows.slice(0, 20),
          icon: <Tv className="h-5 w-5 text-orange-400" />,
        })
      }
    } else {
      if (music.length > 0) {
        sections.push({
          id: 'time-night-ambient',
          title: 'Late Night Sounds',
          items: music.slice(0, 20),
          icon: <CloudMoon className="h-5 w-5 text-purple-400" />,
        })
      }
      if (audiobooks.length > 0) {
        sections.push({
          id: 'time-night-audiobooks',
          title: 'Nighttime Stories',
          items: audiobooks.slice(0, 20),
          icon: <BookOpen className="h-5 w-5 text-slate-400" />,
        })
      }
      if (podcasts.length > 0) {
        sections.push({
          id: 'time-night-podcasts',
          title: 'Late Night Listening',
          items: podcasts.slice(0, 20),
          icon: <Headphones className="h-5 w-5 text-purple-300" />,
        })
      }
    }

    return sections
  }, [mediaItems, timeOfDay])
}

// ──────────────────────────────────────────────
// LivingHomeScreen Component
// ──────────────────────────────────────────────

interface LivingHomeScreenProps {
  mediaItems: MediaItem[]
  onPlay: (item: MediaItem) => void
}

export function LivingHomeScreen({ mediaItems, onPlay }: LivingHomeScreenProps) {
  const { timeOfDay } = useTimeContext()
  const [chipLoading, setChipLoading] = useState<string | null>(null)

  const config = TIME_CONFIGS[timeOfDay]

  // Handle chip click — triggers AI Concierge or Radio API
  const handleChipClick = useCallback(async (chip: typeof config.chips[number]) => {
    setChipLoading(chip.label)
    try {
      const isMusicRequest = chip.label.toLowerCase().includes('music') ||
        chip.label.toLowerCase().includes('sounds') ||
        chip.label.toLowerCase().includes('jazz') ||
        chip.label.toLowerCase().includes('vibes')

      if (isMusicRequest) {
        const res = await fetch('/api/ai/radio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'mood',
            mood: chip.query,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.tracks && data.tracks.length > 0) {
            const { useAppStore } = await import('@/store/useAppStore')
            const { setAudioQueue, setAudioQueueIndex, setCurrentMedia, setIsPlaying } = useAppStore.getState()
            setAudioQueue(data.tracks)
            setAudioQueueIndex(0)
            setCurrentMedia(data.tracks[0])
            setIsPlaying(true)
          }
        }
      } else {
        const res = await fetch('/api/ai/concierge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: chip.query }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.items && data.items.length > 0) {
            onPlay(data.items[0])
          }
        }
      }
    } catch (err) {
      console.error('Chip action failed:', err)
    } finally {
      setChipLoading(null)
    }
  }, [onPlay])

  return (
    <div className="px-6 mb-4 pt-3">
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        `bg-gradient-to-r ${config.gradient}`,
        "border border-white/10",
        "backdrop-blur-xl shadow-2xl"
      )}>
        {/* Decorative orbs */}
        <div className={cn(
          "absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4",
          timeOfDay === 'morning' && 'bg-amber-400/15',
          timeOfDay === 'afternoon' && 'bg-cyan-400/15',
          timeOfDay === 'evening' && 'bg-rose-400/15',
          timeOfDay === 'night' && 'bg-purple-400/10'
        )} />
        <div className={cn(
          "absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4",
          timeOfDay === 'morning' && 'bg-orange-400/10',
          timeOfDay === 'afternoon' && 'bg-teal-400/10',
          timeOfDay === 'evening' && 'bg-purple-400/10',
          timeOfDay === 'night' && 'bg-slate-400/8'
        )} />

        <div className="relative z-10 px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4">
          {/* Left: Greeting + Description */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
              `bg-gradient-to-br ${config.iconBg}`,
              "shadow-lg"
            )}>
              {config.icon}
            </div>
            <div className="min-w-0">
              <h2 className={cn(
                "text-lg sm:text-xl font-bold truncate",
                timeOfDay === 'morning' && 'bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent',
                timeOfDay === 'afternoon' && 'bg-gradient-to-r from-cyan-200 to-teal-300 bg-clip-text text-transparent',
                timeOfDay === 'evening' && 'bg-gradient-to-r from-orange-200 to-rose-300 bg-clip-text text-transparent',
                timeOfDay === 'night' && 'bg-gradient-to-r from-purple-200 to-slate-300 bg-clip-text text-transparent'
              )}>
                {config.greeting}
              </h2>
              <p className="text-xs text-muted-foreground/70 truncate">{config.description}</p>
            </div>
          </div>

          {/* Right: Quick Action Chips (desktop) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {config.chips.map((chip) => (
              <Button
                key={chip.label}
                variant="ghost"
                size="sm"
                disabled={chipLoading !== null}
                onClick={() => handleChipClick(chip)}
                className={cn(
                  "h-8 px-3 gap-1.5 text-xs rounded-full font-medium",
                  "bg-white/5 border border-white/10",
                  "hover:bg-white/10 hover:border-white/20",
                  "text-muted-foreground/80 hover:text-foreground/90",
                  "transition-all duration-200",
                  "disabled:opacity-40",
                  chipLoading === chip.label && "animate-pulse"
                )}
              >
                {chipLoading === chip.label ? (
                  <div className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  chip.icon
                )}
                {chip.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Mobile chips — below the main row */}
        <div className="relative z-10 px-5 pb-3 sm:hidden flex flex-wrap gap-1.5">
          {config.chips.map((chip) => (
            <Button
              key={chip.label}
              variant="ghost"
              size="sm"
              disabled={chipLoading !== null}
              onClick={() => handleChipClick(chip)}
              className={cn(
                "h-7 px-2.5 gap-1 text-[11px] rounded-full font-medium",
                "bg-white/5 border border-white/10",
                "hover:bg-white/10 hover:border-white/20",
                "text-muted-foreground/80 hover:text-foreground/90",
                "transition-all duration-200",
                "disabled:opacity-40",
                chipLoading === chip.label && "animate-pulse"
              )}
            >
              {chipLoading === chip.label ? (
                <div className="h-3 w-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                chip.icon
              )}
              {chip.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
