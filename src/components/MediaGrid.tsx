'use client'

import { useRef, useState } from 'react'
import { useAppStore, MediaType } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MediaSection {
  id: string
  title: string
  items: any[]
  icon?: React.ReactNode
}

interface MediaGridProps {
  items: any[]
  onRefresh: () => void
  sections?: MediaSection[]
  onWatchLater?: (item: any) => void
  onRemoveWatchLater?: (id: string) => void
  isInWatchLater?: (id: string) => boolean
  onPlay?: (item: any) => void
}

function HorizontalShelf({
  section,
  onWatchLater,
  onRemoveWatchLater,
  isInWatchLater,
  onPlay,
}: {
  section: MediaSection
  onWatchLater?: (item: any) => void
  onRemoveWatchLater?: (id: string) => void
  isInWatchLater?: (id: string) => boolean
  onPlay?: (item: any) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = scrollRef.current.clientWidth * 0.75
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
    // Check scroll after animation
    setTimeout(checkScroll, 350)
  }

  if (section.items.length === 0) return null

  return (
    <section className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 px-6">
        <div className="flex items-center gap-2">
          {section.icon}
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <span className="text-sm text-muted-foreground">({section.items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-primary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'See all'}
            {expanded ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {expanded ? (
        // Expanded grid view
        <div className="px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {section.items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onWatchLater={onWatchLater}
              onRemoveWatchLater={onRemoveWatchLater}
              isInWatchLater={isInWatchLater?.(item.id)}
              onPlay={onPlay}
            />
          ))}
        </div>
      ) : (
        // Horizontal scrollable row
        <div className="relative group/shelf">
          {/* Left scroll button */}
          {canScrollLeft && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full shadow-lg opacity-0 group-hover/shelf:opacity-100 transition-opacity"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            onScroll={checkScroll}
            onLoad={checkScroll}
          >
            {section.items.map((item) => (
              <div key={item.id} className="shrink-0 w-[260px] sm:w-[280px]">
                <MediaCard
                  item={item}
                  onWatchLater={onWatchLater}
                  onRemoveWatchLater={onRemoveWatchLater}
                  isInWatchLater={isInWatchLater?.(item.id)}
                  onPlay={onPlay}
                />
              </div>
            ))}
          </div>

          {/* Right scroll button */}
          {canScrollRight && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full shadow-lg opacity-0 group-hover/shelf:opacity-100 transition-opacity"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Fade edges */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-[5]" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />
          )}
        </div>
      )}
    </section>
  )
}

export function MediaGrid({ items, onRefresh, sections, onWatchLater, onRemoveWatchLater, isInWatchLater, onPlay }: MediaGridProps) {
  const { activeCategory, sortBy, setSortBy, isLoading } = useAppStore()

  const categoryTitle: Record<MediaType, string> = {
    ALL: 'Home',
    MOVIE: 'Movies',
    TV_SHOW: 'TV Shows',
    MUSIC: 'Music',
    PODCAST: 'Podcasts',
    AUDIOBOOK: 'Audiobooks',
    JELLYFIN: 'Jellyfin NAS',
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // If sections are provided, render them as horizontal shelves
  if (sections && sections.length > 0) {
    return (
      <div className="py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 px-6">
          <h1 className="text-2xl font-bold">{categoryTitle[activeCategory] || 'Home'}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={sortBy === 'popular' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('popular')}
              className="gap-1"
            >
              Popular
            </Button>
            <Button
              variant={sortBy === 'recent' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('recent')}
              className="gap-1"
            >
              Recent
            </Button>
          </div>
        </div>

        {sections.map((section) => (
          <HorizontalShelf
            key={section.id}
            section={section}
            onWatchLater={onWatchLater}
            onRemoveWatchLater={onRemoveWatchLater}
            isInWatchLater={isInWatchLater}
            onPlay={onPlay}
          />
        ))}
      </div>
    )
  }

  // Fallback: Group by genre for "ALL" category or flat grid
  const genreGroups: Record<string, any[]> = {}
  if (activeCategory === 'ALL') {
    items.forEach((item) => {
      const genre = item.genre || 'Other'
      if (!genreGroups[genre]) genreGroups[genre] = []
      genreGroups[genre].push(item)
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{categoryTitle[activeCategory] || 'Home'}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={sortBy === 'popular' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('popular')}
            className="gap-1"
          >
            Popular
          </Button>
          <Button
            variant={sortBy === 'recent' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('recent')}
            className="gap-1"
          >
            Recent
          </Button>
        </div>
      </div>

      {activeCategory === 'ALL' && Object.keys(genreGroups).length > 0 ? (
        Object.entries(genreGroups).map(([genre, genreItems]) => (
          <section key={genre} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{genre}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {genreItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onWatchLater={onWatchLater}
                  onRemoveWatchLater={onRemoveWatchLater}
                  isInWatchLater={isInWatchLater?.(item.id)}
                  onPlay={onPlay}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-20">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 3v18" />
                <path d="M17 3v18" />
                <path d="M3 7.5h4" />
                <path d="M17 7.5h4" />
                <path d="M3 12h18" />
                <path d="M3 16.5h4" />
                <path d="M17 16.5h4" />
              </svg>
              <p className="text-lg font-medium">No content found</p>
              <p className="text-sm mt-1">Try a different category or add some media</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onWatchLater={onWatchLater}
                  onRemoveWatchLater={onRemoveWatchLater}
                  isInWatchLater={isInWatchLater?.(item.id)}
                  onPlay={onPlay}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
