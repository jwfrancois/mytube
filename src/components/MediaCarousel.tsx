'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MediaCarouselProps {
  title: string
  items: any[]
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function MediaCarousel({ title, items: rawItems, icon, actionLabel, onAction }: MediaCarouselProps) {
  // Deduplicate items by ID as a safety net
  const items = useMemo(() => {
    const seen = new Set<string>()
    return rawItems.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [rawItems])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftArrow(el.scrollLeft > 20)
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 20)
  }, [])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.8
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }, [])

  if (items.length === 0) return null

  return (
    <section className="group/carousel relative mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-6 md:px-10 lg:px-14">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg md:text-xl font-bold text-foreground">{title}</h2>
        </div>
        {actionLabel && onAction && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAction}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Carousel container */}
      <div className="relative">
        {/* Left arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 md:w-16 bg-gradient-to-r from-background/95 to-transparent flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Scroll left"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
              <ChevronLeft className="h-5 w-5 text-white" />
            </div>
          </button>
        )}

        {/* Right arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 md:w-16 bg-gradient-to-l from-background/95 to-transparent flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            aria-label="Scroll right"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
              <ChevronRight className="h-5 w-5 text-white" />
            </div>
          </button>
        )}

        {/* Scrollable area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 md:gap-4 overflow-x-auto px-6 md:px-10 lg:px-14 pb-2 scrollbar-none"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px] xl:w-[230px]"
            >
              <MediaCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* Skeleton carousel for loading state */
export function MediaCarouselSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 px-6 md:px-10 lg:px-14">
        <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="h-5 w-16 bg-muted/50 rounded animate-pulse" />
      </div>
      <div className="flex gap-3 md:gap-4 overflow-hidden px-6 md:px-10 lg:px-14 pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px] xl:w-[230px]">
            <div className="aspect-[2/3] rounded-lg bg-muted/50 animate-pulse" />
            <div className="mt-2 h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
            <div className="mt-1.5 h-3 w-1/2 bg-muted/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}
