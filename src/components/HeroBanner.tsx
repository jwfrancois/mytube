'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Info, Volume2, VolumeX, Star, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroItem {
  id: string
  title: string
  description: string
  thumbnail: string
  type: string
  genre: string
  releaseYear: number
  communityRating?: number
  isJellyfin?: boolean
  jellyfinId?: string
  itemType?: string
  hasChildren?: boolean
  childCount?: number
  mediaSourceId?: string
  videoUrl?: string
  duration?: string
  artist?: string
  views?: number
  channel?: string
  createdAt?: string
  parentId?: string
  collectionType?: string
}

interface HeroBannerProps {
  items: HeroItem[]
  onPlay: (item: HeroItem) => void
  onMoreInfo: (item: HeroItem) => void
}

export function HeroBanner({ items, onPlay, onMoreInfo }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const TOUCH_START_X = useRef(0)

  const currentItem = items[currentIndex]

  const goToSlide = useCallback((index: number) => {
    if (index === currentIndex || isTransitioning) return
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex(index)
      setIsTransitioning(false)
    }, 300)
  }, [currentIndex, isTransitioning])

  const goNext = useCallback(() => {
    const next = (currentIndex + 1) % items.length
    goToSlide(next)
  }, [currentIndex, items.length, goToSlide])

  const goPrev = useCallback(() => {
    const prev = (currentIndex - 1 + items.length) % items.length
    goToSlide(prev)
  }, [currentIndex, items.length, goToSlide])

  // Auto-rotation timer
  useEffect(() => {
    if (items.length <= 1 || isPaused) return

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(goNext, 8000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [goNext, items.length, isPaused])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    TOUCH_START_X.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = TOUCH_START_X.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  if (!items.length || !currentItem) return null

  // Truncate description
  const truncate = (str: string, max: number) => {
    if (!str) return ''
    return str.length > max ? str.slice(0, max) + '…' : str
  }

  return (
    <section
      className="relative w-full h-[50vh] min-h-[360px] max-h-[600px] overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image with Ken Burns effect */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-in-out",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
      >
        {currentItem.thumbnail ? (
          <img
            src={currentItem.thumbnail}
            alt={currentItem.title}
            className="w-full h-full object-cover animate-hero-slide"
            key={currentItem.id}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f0f] hero-gradient-animated" />
        )}
      </div>

      {/* Multiple gradient overlays for cinematic depth */}
      {/* Bottom gradient — strong, for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      {/* Top gradient — subtle, for header visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent" />
      {/* Left gradient — for text area readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,oklch(0.11_0_0/60%)_100%)]" />

      {/* Content overlay */}
      <div
        className={cn(
          "absolute inset-0 flex items-end pb-16 sm:pb-20 px-6 sm:px-12 lg:px-16 transition-all duration-500",
          isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        )}
        key={`content-${currentItem.id}`}
      >
        <div className="max-w-2xl space-y-3 sm:space-y-4">
          {/* Type badge + year */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="bg-mythic/20 text-mythic-foreground border-mythic/40 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm"
            >
              {currentItem.type === 'TV_SHOW' ? 'TV Series' : currentItem.type === 'COLLECTION' ? 'Collection' : currentItem.type.charAt(0) + currentItem.type.slice(1).toLowerCase()}
            </Badge>
            {currentItem.releaseYear > 0 && (
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs backdrop-blur-sm">
                {currentItem.releaseYear}
              </Badge>
            )}
            {currentItem.communityRating && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1 backdrop-blur-sm">
                <Star className="h-3 w-3 fill-amber-400" />
                {currentItem.communityRating.toFixed(1)}
              </Badge>
            )}
            {currentItem.isJellyfin && (
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs backdrop-blur-sm">
                NAS
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none text-white drop-shadow-lg">
            {currentItem.title}
          </h1>

          {/* Genre tags */}
          {currentItem.genre && (
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              {currentItem.genre.split(',').map((g, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-white/40">•</span>}
                  <span>{g.trim()}</span>
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-xl line-clamp-3">
            {truncate(currentItem.description, 200)}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-bold gap-2 rounded-md px-8 h-11 shadow-xl shadow-black/40"
              onClick={() => onPlay(currentItem)}
            >
              <Play className="h-5 w-5 fill-black" />
              Play
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm font-semibold gap-2 rounded-md px-6 h-11 border border-white/10"
              onClick={() => onMoreInfo(currentItem)}
            >
              <Info className="h-5 w-5" />
              More Info
            </Button>

            {/* Mute toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10 ml-2"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm border border-white/10"
            onClick={goPrev}
            aria-label="Previous"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm border border-white/10"
            onClick={goNext}
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
          {items.map((_, index) => (
            <button
              key={index}
              className={cn(
                "rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-6 h-1.5 bg-mythic"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              )}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Bottom fade to content */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
