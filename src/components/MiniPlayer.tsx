'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronUp,
  X,
  Music,
  Mic,
  BookOpen,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MiniPlayer() {
  const {
    currentMedia,
    setCurrentMedia,
    audioElement,
    miniPlayerMode,
    setMiniPlayerMode,
    playNext,
    playPrevious,
  } = useAppStore()

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false)
  const initRef = useRef(false)

  // Sync with audio element time updates
  useEffect(() => {
    const audio = audioElement
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onPlay = () => setIsActuallyPlaying(true)
    const onPause = () => setIsActuallyPlaying(false)
    const onEnded = () => setIsActuallyPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    // Initialize current state via event dispatch to avoid direct setState in effect
    if (!initRef.current) {
      initRef.current = true
      // Use RAF to defer initialization outside of the effect's synchronous body
      requestAnimationFrame(() => {
        setCurrentTime(audio.currentTime || 0)
        if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration)
        setIsActuallyPlaying(!audio.paused)
      })
    }

    return () => {
      initRef.current = false
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [audioElement]

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const audio = useAppStore.getState().audioElement
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [])

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    playNext()
  }, [playNext])

  const handlePrevious = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    playPrevious()
  }, [playPrevious])

  const handleExpand = useCallback(() => {
    setMiniPlayerMode(false)
  }, [setMiniPlayerMode])

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const audio = useAppStore.getState().audioElement
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setMiniPlayerMode(false)
    setCurrentMedia(null)
  }, [setMiniPlayerMode, setCurrentMedia])

  const handleSeek = useCallback((value: number[]) => {
    const audio = useAppStore.getState().audioElement
    if (!audio || !duration) return
    audio.currentTime = (value[0] / 100) * duration
    setCurrentTime((value[0] / 100) * duration)
  }, [duration])

  if (!currentMedia || !miniPlayerMode) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const isPodcast = currentMedia.type === 'PODCAST'
  const isAudiobook = currentMedia.type === 'AUDIOBOOK'

  const getTypeIcon = () => {
    switch (currentMedia.type) {
      case 'PODCAST': return <Mic className="h-3 w-3" />
      case 'AUDIOBOOK': return <BookOpen className="h-3 w-3" />
      default: return <Music className="h-3 w-3" />
    }
  }

  const accentBg = isPodcast
    ? 'bg-orange-500 hover:bg-orange-600'
    : isAudiobook
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-purple-500 hover:bg-purple-600'

  const accentBarColor = isPodcast
    ? '[&_[data-orientation=horizontal]>.bg-primary]:bg-orange-500'
    : isAudiobook
    ? '[&_[data-orientation=horizontal]>.bg-primary]:bg-amber-500'
    : '[&_[data-orientation=horizontal]>.bg-primary]:bg-purple-500'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 group/mini"
      onClick={handleExpand}
      role="button"
      tabIndex={0}
      aria-label="Expand audio player"
    >
      {/* Progress bar at top */}
      <div className="h-0.5 bg-muted/50">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isPodcast ? "bg-orange-500" : isAudiobook ? "bg-amber-500" : "bg-purple-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Player bar */}
      <div className="backdrop-blur-xl bg-background/80 border-t border-border px-3 py-2">
        <div className="flex items-center gap-3 max-w-screen-2xl mx-auto">
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-md">
            {currentMedia.thumbnail ? (
              <img
                src={currentMedia.thumbnail}
                alt={currentMedia.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={cn(
                "w-full h-full flex items-center justify-center text-white",
                isPodcast ? "bg-gradient-to-br from-orange-500 to-red-600" :
                isAudiobook ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                "bg-gradient-to-br from-purple-500 to-pink-600"
              )}>
                {getTypeIcon()}
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 hidden sm:block">
            <p className="text-sm font-medium truncate leading-tight">{currentMedia.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentMedia.artist || currentMedia.channel}
            </p>
          </div>

          {/* Mobile: title only */}
          <div className="flex-1 min-w-0 sm:hidden">
            <p className="text-sm font-medium truncate leading-tight">{currentMedia.title}</p>
          </div>

          {/* Time display */}
          <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handlePrevious}
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-full", accentBg, "text-white hover:text-white")}
              onClick={togglePlay}
              aria-label={isActuallyPlaying ? 'Pause' : 'Play'}
            >
              {isActuallyPlaying ? (
                <Pause className="h-4 w-4 fill-white" />
              ) : (
                <Play className="h-4 w-4 fill-white ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleNext}
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Expand / Close buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={handleExpand}
              aria-label="Expand player"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleClose}
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expandable seek bar (visible on hover) */}
        <div className="max-w-screen-2xl mx-auto mt-1 opacity-0 group-hover/mini:opacity-100 transition-opacity duration-200">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleSeek}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={cn(
              "cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_.relative]:h-1.5",
              accentBarColor
            )}
          />
        </div>
      </div>
    </div>
  )
}
