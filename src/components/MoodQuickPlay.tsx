'use client'

import { useState, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Brain, Leaf, Flame, PartyPopper, Heart, Moon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ──────────────────────────────────────────────
// Mood Definitions
// ──────────────────────────────────────────────

interface MoodConfig {
  id: string
  label: string
  mood: string
  icon: React.ElementType
  gradient: string
  hoverGradient: string
  iconColor: string
  glowColor: string
}

const MOODS: MoodConfig[] = [
  {
    id: 'focus',
    label: 'Focus',
    mood: 'focus concentration',
    icon: Brain,
    gradient: 'from-teal-500 to-cyan-600',
    hoverGradient: 'hover:from-teal-400 hover:to-cyan-500',
    iconColor: 'text-teal-100',
    glowColor: 'bg-teal-400/20',
  },
  {
    id: 'relax',
    label: 'Relax',
    mood: 'relax ambient chill',
    icon: Leaf,
    gradient: 'from-purple-400 to-violet-600',
    hoverGradient: 'hover:from-purple-300 hover:to-violet-500',
    iconColor: 'text-purple-100',
    glowColor: 'bg-purple-400/20',
  },
  {
    id: 'workout',
    label: 'Workout',
    mood: 'workout high-energy',
    icon: Flame,
    gradient: 'from-red-500 to-orange-600',
    hoverGradient: 'hover:from-red-400 hover:to-orange-500',
    iconColor: 'text-red-100',
    glowColor: 'bg-red-400/20',
  },
  {
    id: 'party',
    label: 'Party',
    mood: 'party upbeat dance',
    icon: PartyPopper,
    gradient: 'from-pink-500 to-rose-600',
    hoverGradient: 'hover:from-pink-400 hover:to-rose-500',
    iconColor: 'text-pink-100',
    glowColor: 'bg-pink-400/20',
  },
  {
    id: 'romance',
    label: 'Romance',
    mood: 'romantic love',
    icon: Heart,
    gradient: 'from-rose-400 to-pink-600',
    hoverGradient: 'hover:from-rose-300 hover:to-pink-500',
    iconColor: 'text-rose-100',
    glowColor: 'bg-rose-400/20',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    mood: 'sleep ambient sounds',
    icon: Moon,
    gradient: 'from-slate-500 to-indigo-900',
    hoverGradient: 'hover:from-slate-400 hover:to-indigo-800',
    iconColor: 'text-slate-200',
    glowColor: 'bg-slate-400/20',
  },
]

// ──────────────────────────────────────────────
// MoodQuickPlay Component
// ──────────────────────────────────────────────

export function MoodQuickPlay() {
  const [loadingMood, setLoadingMood] = useState<string | null>(null)
  const [activeMood, setActiveMood] = useState<string | null>(null)

  const { setAudioQueue, setAudioQueueIndex, setCurrentMedia, setIsPlaying, audioTrack, isPlaying } = useAppStore()

  const handleMoodClick = useCallback(async (moodConfig: MoodConfig) => {
    setLoadingMood(moodConfig.id)
    setActiveMood(moodConfig.id)

    try {
      const res = await fetch('/api/ai/radio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mood', mood: moodConfig.mood }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create mood playlist')
      }

      const data = await res.json()
      const tracks: MediaItem[] = data.tracks || []

      if (tracks.length > 0) {
        setAudioQueue(tracks)
        setAudioQueueIndex(0)
        setCurrentMedia(tracks[0])
        setIsPlaying(true)
      }
    } catch (err) {
      console.error('Mood QuickPlay error:', err)
    } finally {
      setLoadingMood(null)
    }
  }, [setAudioQueue, setAudioQueueIndex, setCurrentMedia, setIsPlaying])

  return (
    <div className="px-6 mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-rose-500/20 border border-white/10">
          <Brain className="h-4.5 w-4.5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Mood QuickPlay</h2>
          <p className="text-[11px] text-muted-foreground/60">One tap to match your vibe</p>
        </div>
      </div>

      {/* Mood Cards Row */}
      <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
        {MOODS.map((mood) => {
          const Icon = mood.icon
          const isLoading = loadingMood === mood.id
          const isActive = activeMood === mood.id

          return (
            <button
              key={mood.id}
              onClick={() => handleMoodClick(mood)}
              disabled={loadingMood !== null}
              className={cn(
                // Base
                "group relative overflow-hidden rounded-2xl shrink-0",
                "w-[120px] h-[120px] sm:w-[130px] sm:h-[130px]",
                "flex flex-col items-center justify-center gap-2.5",
                // Gradient
                "bg-gradient-to-br",
                mood.gradient,
                mood.hoverGradient,
                // Effects
                "border border-white/10",
                "backdrop-blur-xl shadow-lg",
                "transition-all duration-300",
                "hover:scale-105 hover:shadow-xl hover:shadow-black/30",
                "active:scale-[0.97]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                // Active ring
                isActive && !isLoading && "ring-2 ring-white/40 ring-offset-2 ring-offset-background",
              )}
            >
              {/* Decorative top-right glow */}
              <div className={cn(
                "absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl -translate-y-1/3 translate-x-1/3 opacity-60",
                mood.glowColor,
              )} />

              {/* Decorative bottom-left glow */}
              <div className={cn(
                "absolute bottom-0 left-0 w-12 h-12 rounded-full blur-xl translate-y-1/3 -translate-x-1/3 opacity-40",
                mood.glowColor,
              )} />

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                {isLoading ? (
                  <Loader2 className={cn("h-7 w-7 animate-spin text-white/80")} />
                ) : (
                  <Icon className={cn("h-7 w-7 transition-transform duration-300 group-hover:scale-110", mood.iconColor)} />
                )}
                <span className={cn(
                  "text-sm font-semibold tracking-wide",
                  isLoading ? "text-white/60" : "text-white/90",
                )}>
                  {mood.label}
                </span>

                {/* Now Playing indicator */}
                {isActive && !isLoading && (
                  <div className="flex items-center gap-1">
                    {isPlaying ? (
                      <div className="flex items-center gap-0.5">
                        <span className="w-0.5 h-2 bg-white/70 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate]" />
                        <span className="w-0.5 h-3 bg-white/70 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.2s]" />
                        <span className="w-0.5 h-2 bg-white/70 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.4s]" />
                      </div>
                    ) : (
                      <span className="text-[9px] text-white/50">Loaded</span>
                    )}
                  </div>
                )}
              </div>

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] rounded-2xl z-20 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                    <span className="text-[10px] text-white/70">Loading</span>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
