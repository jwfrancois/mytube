'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Film,
  Tv,
  Music,
  Gamepad2,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Newspaper,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface NewsItem {
  title: string
  snippet: string
  url: string
  source: string
  date: string
  category: string
}

type Category = 'movies' | 'tv' | 'music' | 'gaming'

// --- Category config ---

const CATEGORIES: {
  value: Category
  label: string
  icon: React.ReactNode
  gradient: string
  accentColor: string
  orbColor: string
}[] = [
  {
    value: 'movies',
    label: 'Movies',
    icon: <Film className="h-4 w-4" />,
    gradient: 'from-amber-500/10 via-orange-500/8 to-rose-500/5',
    accentColor: 'amber',
    orbColor: 'bg-amber-500/10',
  },
  {
    value: 'tv',
    label: 'TV',
    icon: <Tv className="h-4 w-4" />,
    gradient: 'from-emerald-500/10 via-teal-500/8 to-emerald-600/5',
    accentColor: 'emerald',
    orbColor: 'bg-emerald-500/10',
  },
  {
    value: 'music',
    label: 'Music',
    icon: <Music className="h-4 w-4" />,
    gradient: 'from-rose-500/10 via-pink-500/8 to-orange-500/5',
    accentColor: 'rose',
    orbColor: 'bg-rose-500/10',
  },
  {
    value: 'gaming',
    label: 'Gaming',
    icon: <Gamepad2 className="h-4 w-4" />,
    gradient: 'from-orange-500/10 via-amber-500/8 to-rose-500/5',
    accentColor: 'orange',
    orbColor: 'bg-orange-500/10',
  },
]

// --- Helper to get accent-based Tailwind classes (avoiding dynamic class issues) ---

const ACCENT_STYLES: Record<Category, {
  tabActive: string
  badge: string
  iconBg: string
  iconGradient: string
  titleGradient: string
  cardHoverBorder: string
  cardHoverBg: string
  sourceColor: string
}> = {
  movies: {
    tabActive: 'data-[state=active]:text-amber-300',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25',
    iconGradient: 'from-amber-300 to-orange-300',
    titleGradient: 'from-amber-300 to-orange-300',
    cardHoverBorder: 'hover:border-amber-500/30',
    cardHoverBg: 'hover:bg-amber-500/5',
    sourceColor: 'text-amber-400/70',
  },
  tv: {
    tabActive: 'data-[state=active]:text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/25',
    iconGradient: 'from-emerald-300 to-teal-300',
    titleGradient: 'from-emerald-300 to-teal-300',
    cardHoverBorder: 'hover:border-emerald-500/30',
    cardHoverBg: 'hover:bg-emerald-500/5',
    sourceColor: 'text-emerald-400/70',
  },
  music: {
    tabActive: 'data-[state=active]:text-rose-300',
    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    iconBg: 'bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/25',
    iconGradient: 'from-rose-300 to-pink-300',
    titleGradient: 'from-rose-300 to-pink-300',
    cardHoverBorder: 'hover:border-rose-500/30',
    cardHoverBg: 'hover:bg-rose-500/5',
    sourceColor: 'text-rose-400/70',
  },
  gaming: {
    tabActive: 'data-[state=active]:text-orange-300',
    badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/25',
    iconGradient: 'from-orange-300 to-amber-300',
    titleGradient: 'from-orange-300 to-amber-300',
    cardHoverBorder: 'hover:border-orange-500/30',
    cardHoverBg: 'hover:bg-orange-500/5',
    sourceColor: 'text-orange-400/70',
  },
}

// --- News Card Component ---

function NewsCard({ item, styles }: { item: NewsItem; styles: (typeof ACCENT_STYLES)[Category] }) {
  const formattedDate = (() => {
    try {
      const d = new Date(item.date)
      if (isNaN(d.getTime())) return item.date
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return item.date
    }
  })()

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group block rounded-xl p-4',
        'bg-white/[0.03] border border-white/[0.06]',
        styles.cardHoverBorder,
        styles.cardHoverBg,
        'transition-all duration-300 cursor-pointer',
        'hover:shadow-lg hover:shadow-black/10',
        'min-w-[260px] sm:min-w-[280px] lg:min-w-0'
      )}
    >
      {/* Source + Date */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-2 py-0.5 gap-1', styles.badge)}
        >
          <Newspaper className="h-2.5 w-2.5" />
          {item.source}
        </Badge>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {formattedDate}
        </span>
      </div>

      {/* Title */}
      <h3 className={cn(
        'text-sm font-semibold leading-snug mb-2',
        'bg-gradient-to-r bg-clip-text text-transparent',
        styles.titleGradient,
        'group-hover:brightness-110 transition-all'
      )}>
        {item.title}
      </h3>

      {/* Snippet */}
      <p className="text-xs text-muted-foreground/60 leading-relaxed line-clamp-3 mb-3">
        {item.snippet}
      </p>

      {/* Read more */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
        <ExternalLink className="h-3 w-3" />
        <span>Read more</span>
      </div>
    </a>
  )
}

// --- Skeleton Card ---

function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] min-w-[260px] sm:min-w-[280px] lg:min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-5/6 mb-3" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// --- Main Component ---

export function EntertainmentHub() {
  const [activeCategory, setActiveCategory] = useState<Category>('movies')
  const [itemsMap, setItemsMap] = useState<Record<Category, NewsItem[]>>({
    movies: [],
    tv: [],
    music: [],
    gaming: [],
  })
  const [loadingMap, setLoadingMap] = useState<Record<Category, boolean>>({
    movies: false,
    tv: false,
    music: false,
    gaming: false,
  })
  const [errorMap, setErrorMap] = useState<Record<Category, string | null>>({
    movies: null,
    tv: null,
    music: null,
    gaming: null,
  })

  // Fetch news for a category
  const fetchCategory = useCallback(async (category: Category) => {
    setLoadingMap((prev) => ({ ...prev, [category]: true }))
    setErrorMap((prev) => ({ ...prev, [category]: null }))

    try {
      const res = await fetch(`/api/entertainment?category=${category}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch')
      }
      const data = await res.json()
      setItemsMap((prev) => ({ ...prev, [category]: data.items || [] }))
    } catch (err: any) {
      setErrorMap((prev) => ({ ...prev, [category]: err.message || 'Something went wrong' }))
    } finally {
      setLoadingMap((prev) => ({ ...prev, [category]: false }))
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    fetchCategory('movies')
  }, [fetchCategory])

  // Refresh when category changes
  const handleCategoryChange = useCallback(
    (value: string) => {
      const cat = value as Category
      setActiveCategory(cat)
      // Only fetch if we don't have data for this category yet
      if (itemsMap[cat].length === 0 && !loadingMap[cat]) {
        fetchCategory(cat)
      }
    },
    [itemsMap, loadingMap, fetchCategory]
  )

  // Manual refresh
  const handleRefresh = useCallback(() => {
    fetchCategory(activeCategory)
  }, [activeCategory, fetchCategory])

  const styles = ACCENT_STYLES[activeCategory]
  const catConfig = CATEGORIES.find((c) => c.value === activeCategory)!
  const items = itemsMap[activeCategory]
  const isLoading = loadingMap[activeCategory]
  const error = errorMap[activeCategory]

  return (
    <div className="px-6 mb-8">
      {/* Glassmorphism Panel */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          `bg-gradient-to-br ${catConfig.gradient}`,
          'border border-white/10',
          'backdrop-blur-xl shadow-2xl shadow-black/5',
          'transition-all duration-500'
        )}
      >
        {/* Decorative blur orbs */}
        <div
          className={cn(
            'absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3',
            catConfig.orbColor
          )}
        />
        <div
          className={cn(
            'absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3',
            catConfig.orbColor
          )}
        />

        <div className="relative z-10 p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl shadow-lg',
                  styles.iconBg
                )}
              >
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2
                  className={cn(
                    'text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
                    styles.titleGradient
                  )}
                >
                  Entertainment Hub
                </h2>
                <p className="text-xs text-muted-foreground/70">
                  Trending news &amp; what&apos;s hot right now
                </p>
              </div>
            </div>

            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className={cn(
                'shrink-0 gap-1.5 text-muted-foreground/60',
                'hover:text-muted-foreground/90 hover:bg-white/5'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeCategory}
            onValueChange={handleCategoryChange}
            className="w-full"
          >
            <TabsList
              className={cn(
                'bg-white/[0.04] border border-white/[0.06]',
                'rounded-xl p-1 h-auto gap-1',
                'w-full sm:w-fit'
              )}
            >
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className={cn(
                    'gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                    'text-muted-foreground/60',
                    'data-[state=active]:bg-white/[0.08]',
                    ACCENT_STYLES[cat.value].tabActive,
                    'data-[state=active]:shadow-sm',
                    'transition-all duration-200'
                  )}
                >
                  {cat.icon}
                  <span className="hidden xs:inline sm:inline">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab Content — shared container, content changes per tab */}
            <div className="mt-5">
              {/* Loading State */}
              {isLoading && (
                <div className="flex gap-4 overflow-x-auto pb-2 shelf-scrollbar lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-x-visible">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
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

              {/* Results */}
              {!isLoading && !error && items.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-2 shelf-scrollbar lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-x-visible">
                  {items.map((item, idx) => (
                    <NewsCard
                      key={`${item.url}-${idx}`}
                      item={item}
                      styles={styles}
                    />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && items.length === 0 && (
                <div className="text-center py-10">
                  <Newspaper className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/50">
                    No trending news found. Try refreshing.
                  </p>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
