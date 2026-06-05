'use client'

import { useAppStore } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal, TrendingUp, Clock } from 'lucide-react'

interface MediaGridProps {
  items: any[]
  onRefresh: () => void
}

export function MediaGrid({ items, onRefresh }: MediaGridProps) {
  const { activeCategory, sortBy, setSortBy, isLoading } = useAppStore()

  const categoryTitle = {
    ALL: 'Home',
    MOVIE: 'Movies',
    TV_SHOW: 'TV Shows',
    MUSIC: 'Music',
  }[activeCategory] || 'Home'

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

  // Group by genre for "ALL" category
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
        <h1 className="text-2xl font-bold">{categoryTitle}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={sortBy === 'popular' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('popular')}
            className="gap-1"
          >
            <TrendingUp className="h-4 w-4" />
            Popular
          </Button>
          <Button
            variant={sortBy === 'recent' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('recent')}
            className="gap-1"
          >
            <Clock className="h-4 w-4" />
            Recent
          </Button>
        </div>
      </div>

      {activeCategory === 'ALL' && Object.keys(genreGroups).length > 0 ? (
        // Show grouped by genre
        Object.entries(genreGroups).map(([genre, genreItems]) => (
          <section key={genre} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              {genre}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {genreItems.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))
      ) : (
        // Show flat grid
        <>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Film className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No content found</p>
              <p className="text-sm mt-1">Try a different category or add some media</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Film(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 7.5h4" />
      <path d="M17 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 16.5h4" />
    </svg>
  )
}
