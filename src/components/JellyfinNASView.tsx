'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAppStore, type MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Play,
  Star,
  Clock,
  Server,
  Film,
  Tv,
  Music,
  Headphones,
  BookOpen,
  Library,
  Mic,
  Search,
  Grid3X3,
  List,
  SlidersHorizontal,
  ChevronRight,
  FolderOpen,
  Loader2,
  Shuffle,
  RefreshCw,
  LayoutGrid,
  Sparkles,
  Calendar,
  TrendingUp,
  Radio,
  Disc3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface JellyfinLibrary {
  id: string
  name: string
  collectionType: string // 'movies', 'tvshows', 'music', 'books', 'podcasts', etc.
  thumbnail: string
  itemCount: number
}

type ViewMode = 'home' | 'library' | 'detail' | 'search'

interface NASViewState {
  viewMode: ViewMode
  activeLibrary: JellyfinLibrary | null
  activeItem: MediaItem | null
  searchQuery: string
  sortBy: string
  sortOrder: string
  filterGenre: string
  filterYear: string
  displayMode: 'grid' | 'list'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(duration?: string, durationTicks?: number): string | null {
  if (duration) return duration
  if (!durationTicks) return null
  const totalMinutes = Math.round(durationTicks / 600000000)
  if (totalMinutes < 60) return `${totalMinutes}min`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatDurationShort(ticks: number): string {
  if (!ticks) return ''
  const totalSeconds = Math.round(ticks / 10000000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function getLibraryIcon(collectionType: string): React.ElementType {
  switch (collectionType) {
    case 'movies': return Film
    case 'tvshows': return Tv
    case 'music': return Music
    case 'books': return BookOpen
    case 'podcasts': return Mic
    case 'homevideos': return Camera
    default: return FolderOpen
  }
}

function getLibraryColor(collectionType: string): string {
  switch (collectionType) {
    case 'movies': return 'from-red-500/20 to-red-600/5 text-red-500'
    case 'tvshows': return 'from-emerald-500/20 to-emerald-600/5 text-emerald-500'
    case 'music': return 'from-purple-500/20 to-purple-600/5 text-purple-500'
    case 'books': return 'from-amber-500/20 to-amber-600/5 text-amber-500'
    case 'podcasts': return 'from-orange-500/20 to-orange-600/5 text-orange-500'
    default: return 'from-slate-500/20 to-slate-600/5 text-slate-500'
  }
}

function getTypeLabel(itemType: string): string {
  const map: Record<string, string> = {
    Movie: 'Movie',
    Series: 'TV Series',
    Episode: 'Episode',
    Season: 'Season',
    Audio: 'Track',
    MusicAlbum: 'Album',
    MusicArtist: 'Artist',
    AudioBook: 'Audiobook',
    Book: 'Book',
    BoxSet: 'Collection',
    CollectionFolder: 'Library',
    UserView: 'Library',
    Playlist: 'Playlist',
  }
  return map[itemType] || itemType
}

function getTypeIcon(itemType: string): React.ElementType {
  switch (itemType) {
    case 'Movie': return Film
    case 'Series': case 'Season': case 'Episode': return Tv
    case 'Audio': case 'MusicAlbum': case 'MusicArtist': return Music
    case 'AudioBook': return Headphones
    case 'Book': return BookOpen
    case 'BoxSet': return Library
    default: return Film
  }
}

// Type icon component - renders the correct icon based on itemType
function ItemTypeIcon({ itemType, className }: { itemType: string; className?: string }) {
  switch (itemType) {
    case 'Movie': return <Film className={className} />
    case 'Series': case 'Season': case 'Episode': return <Tv className={className} />
    case 'Audio': case 'MusicAlbum': case 'MusicArtist': return <Music className={className} />
    case 'AudioBook': return <Headphones className={className} />
    case 'Book': return <BookOpen className={className} />
    case 'BoxSet': return <Library className={className} />
    default: return <Film className={className} />
  }
}

// Library icon component - renders the correct icon based on collectionType
function LibraryTypeIcon({ collectionType, className }: { collectionType: string; className?: string }) {
  switch (collectionType) {
    case 'movies': return <Film className={className} />
    case 'tvshows': return <Tv className={className} />
    case 'music': return <Music className={className} />
    case 'books': return <BookOpen className={className} />
    case 'podcasts': return <Mic className={className} />
    case 'homevideos': return <Camera className={className} />
    default: return <FolderOpen className={className} />
  }
}

// Camera icon for homevideos (getLibraryIcon needs it)
function Camera(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  )
}

const SORT_OPTIONS = [
  { value: 'SortName', label: 'Name' },
  { value: 'DateCreated,SortName', label: 'Date Added' },
  { value: 'PremiereDate,SortName', label: 'Premiere Date' },
  { value: 'CommunityRating,SortName', label: 'Community Rating' },
  { value: 'Random', label: 'Random' },
  { value: 'ProductionYear,SortName', label: 'Year' },
  { value: 'RunTimeTicks,SortName', label: 'Runtime' },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export function JellyfinNASView() {
  const { jellyfinConnected, setDetailPanelItem } = useAppStore()

  const [state, setState] = useState<NASViewState>({
    viewMode: 'home',
    activeLibrary: null,
    activeItem: null,
    searchQuery: '',
    sortBy: 'SortName',
    sortOrder: 'Ascending',
    filterGenre: '',
    filterYear: '',
    displayMode: 'grid',
  })

  const [libraries, setLibraries] = useState<JellyfinLibrary[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch libraries on mount
  useEffect(() => {
    const fetchLibraries = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/jellyfin/libraries')
        const data = await res.json()
        const libs: JellyfinLibrary[] = (data.items || []).map((item: any) => ({
          id: item.id || item.jellyfinId,
          name: item.title || item.name || 'Library',
          collectionType: item.collectionType || '',
          thumbnail: item.thumbnail || '',
          itemCount: item.childCount || 0,
        }))
        setLibraries(libs)
      } catch (err) {
        console.error('Failed to fetch libraries:', err)
      } finally {
        setLoading(false)
      }
    }
    if (jellyfinConnected) {
      fetchLibraries()
    }
  }, [jellyfinConnected])

  const navigateTo = useCallback((updates: Partial<NASViewState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleItemClick = useCallback((item: MediaItem) => {
    // For leaf items (Movies, Episodes, individual Audio tracks), play directly
    const isLeafItem =
      item.itemType === 'Movie' ||
      item.itemType === 'Episode' ||
      item.itemType === 'Audio' ||
      item.itemType === 'Video' ||
      item.itemType === 'Trailer'

    // For container types (Series, Albums, Collections, etc.), open detail view
    const isContainerItem =
      item.itemType === 'Series' ||
      item.itemType === 'Season' ||
      item.itemType === 'MusicAlbum' ||
      item.itemType === 'AudioBook' ||
      item.itemType === 'BoxSet' ||
      item.itemType === 'Book' ||
      item.itemType === 'Playlist' ||
      item.hasChildren

    if (isContainerItem && !isLeafItem) {
      navigateTo({ viewMode: 'detail', activeItem: item })
    } else {
      // Play directly - set as current media
      useAppStore.getState().setCurrentMedia(item)
    }
  }, [navigateTo])

  const handleBack = useCallback(() => {
    setState((prev) => {
      if (prev.viewMode === 'detail') {
        return { ...prev, viewMode: prev.activeLibrary ? 'library' : 'home', activeItem: null }
      }
      if (prev.viewMode === 'library') {
        return { ...prev, viewMode: 'home', activeLibrary: null }
      }
      if (prev.viewMode === 'search') {
        return { ...prev, viewMode: 'home', searchQuery: '' }
      }
      return prev
    })
  }, [])

  // Render based on view mode
  if (!jellyfinConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <Server className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Jellyfin NAS Not Connected</p>
        <p className="text-sm mt-1">Go to Settings to connect to your Jellyfin server</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Navigation Bar */}
      <NASNavBar
        state={state}
        libraries={libraries}
        onNavigate={navigateTo}
        onBack={handleBack}
        onSearch={(q) => navigateTo({ viewMode: 'search', searchQuery: q })}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {state.viewMode === 'home' && (
          <NASHome
            libraries={libraries}
            loading={loading}
            onLibraryClick={(lib) => navigateTo({ viewMode: 'library', activeLibrary: lib })}
            onItemClick={handleItemClick}
          />
        )}

        {state.viewMode === 'library' && state.activeLibrary && (
          <NASLibraryView
            library={state.activeLibrary}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            filterGenre={state.filterGenre}
            filterYear={state.filterYear}
            displayMode={state.displayMode}
            onSortChange={(sortBy, sortOrder) => navigateTo({ sortBy, sortOrder })}
            onFilterChange={(filterGenre, filterYear) => navigateTo({ filterGenre, filterYear })}
            onDisplayModeChange={(displayMode) => navigateTo({ displayMode })}
            onItemClick={handleItemClick}
          />
        )}

        {state.viewMode === 'detail' && state.activeItem && (
          <NASItemDetail
            item={state.activeItem}
            onBack={handleBack}
            onItemClick={handleItemClick}
          />
        )}

        {state.viewMode === 'search' && (
          <NASSearchView
            query={state.searchQuery}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </div>
  )
}

// ── Navigation Bar ─────────────────────────────────────────────────────────────

function NASNavBar({
  state,
  libraries,
  onNavigate,
  onBack,
  onSearch,
}: {
  state: NASViewState
  libraries: JellyfinLibrary[]
  onNavigate: (updates: Partial<NASViewState>) => void
  onBack: () => void
  onSearch: (q: string) => void
}) {
  const [searchInput, setSearchInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      onSearch(searchInput.trim())
    }
  }, [searchInput, onSearch])

  // Build breadcrumb
  const breadcrumbs: { label: string; onClick?: () => void }[] = [
    { label: 'Jellyfin NAS', onClick: () => onNavigate({ viewMode: 'home', activeLibrary: null, activeItem: null, searchQuery: '' }) },
  ]

  if (state.activeLibrary && (state.viewMode === 'library' || state.viewMode === 'detail')) {
    breadcrumbs.push({
      label: state.activeLibrary.name,
      onClick: () => onNavigate({ viewMode: 'library', activeItem: null }),
    })
  }

  if (state.activeItem && state.viewMode === 'detail') {
    breadcrumbs.push({ label: state.activeItem.title })
  }

  if (state.viewMode === 'search') {
    breadcrumbs.push({ label: `Search: "${state.searchQuery}"` })
  }

  return (
    <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 py-2.5 shrink-0">
      <div className="flex items-center gap-3">
        {/* Back button - show when not on home */}
        {state.viewMode !== 'home' && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1 overflow-hidden">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
              {i === 0 && <Server className="h-4 w-4 text-emerald-500 shrink-0 mr-0.5" />}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate font-medium"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-foreground truncate font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search NAS..."
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
        </form>

        {/* Library quick tabs (show on home only) */}
        {state.viewMode === 'home' && libraries.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {libraries.slice(0, 5).map((lib) => (
                <Button
                  key={lib.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onNavigate({ viewMode: 'library', activeLibrary: lib })}
                >
                  <LibraryTypeIcon collectionType={lib.collectionType} className="h-3.5 w-3.5" />
                  {lib.name}
                </Button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── NAS Home ───────────────────────────────────────────────────────────────────

function NASHome({
  libraries,
  loading,
  onLibraryClick,
  onItemClick,
}: {
  libraries: JellyfinLibrary[]
  loading: boolean
  onLibraryClick: (lib: JellyfinLibrary) => void
  onItemClick: (item: MediaItem) => void
}) {
  const [continueWatching, setContinueWatching] = useState<MediaItem[]>([])
  const [nextUp, setNextUp] = useState<MediaItem[]>([])
  const [latestItems, setLatestItems] = useState<Record<string, MediaItem[]>>({})
  const [loadingSections, setLoadingSections] = useState(true)

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoadingSections(true)
      try {
        // Fetch continue watching, next up, and latest in parallel
        const [resumeRes, nextUpRes] = await Promise.allSettled([
          fetch('/api/jellyfin/resume'),
          fetch('/api/jellyfin/next-up'),
        ])

        if (resumeRes.status === 'fulfilled' && resumeRes.value.ok) {
          const data = await resumeRes.value.json()
          setContinueWatching(data.items || [])
        }

        if (nextUpRes.status === 'fulfilled' && nextUpRes.value.ok) {
          const data = await nextUpRes.value.json()
          setNextUp(data.items || [])
        }

        // Fetch latest for each library
        const latestData: Record<string, MediaItem[]> = {}
        const latestPromises = libraries.map(async (lib) => {
          try {
            const res = await fetch(`/api/jellyfin/latest?parentId=${lib.id}&limit=12`)
            if (res.ok) {
              const data = await res.json()
              latestData[lib.id] = data.items || []
            }
          } catch {}
        })
        await Promise.allSettled(latestPromises)
        setLatestItems(latestData)
      } catch (err) {
        console.error('Failed to fetch NAS home data:', err)
      } finally {
        setLoadingSections(false)
      }
    }

    if (libraries.length > 0) {
      fetchHomeData()
    }
  }, [libraries])

  if (loading) {
    return <HomeSkeleton />
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Library Cards */}
      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          Your Libraries
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {libraries.map((lib) => (
              <button
                key={lib.id}
                onClick={() => onLibraryClick(lib)}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-gradient-to-br border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br transition-transform duration-300 group-hover:scale-110', getLibraryColor(lib.collectionType))}>
                  <LibraryTypeIcon collectionType={lib.collectionType} className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">{lib.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{lib.collectionType || 'media'}</p>
                </div>
              </button>
          ))}
        </div>
      </section>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Continue Watching
          </h2>
          <NASCarousel items={continueWatching} onItemClick={onItemClick} showProgress />
        </section>
      )}

      {/* Next Up */}
      {nextUp.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Next Up
          </h2>
          <NASCarousel items={nextUp} onItemClick={onItemClick} />
        </section>
      )}

      {/* Latest in each library */}
      {libraries.map((lib) => {
        const items = latestItems[lib.id]
        if (!items || items.length === 0) return null

        return (
          <section key={lib.id}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <LibraryTypeIcon collectionType={lib.collectionType} className="h-5 w-5 text-primary" />
                Latest in {lib.name}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => onLibraryClick(lib)}
              >
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <NASCarousel items={items} onItemClick={onItemClick} />
          </section>
        )
      })}

      {/* Loading indicator */}
      {loadingSections && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading NAS content...</span>
        </div>
      )}
    </div>
  )
}

// ── NAS Carousel ───────────────────────────────────────────────────────────────

function NASCarousel({
  items,
  onItemClick,
  showProgress = false,
}: {
  items: MediaItem[]
  onItemClick: (item: MediaItem) => void
  showProgress?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 pb-2 -mx-1 px-1">
      {items.map((item) => (
        <NASCard
          key={item.id}
          item={item}
          onClick={() => onItemClick(item)}
          showProgress={showProgress}
        />
      ))}
    </div>
  )
}

// ── NAS Card ───────────────────────────────────────────────────────────────────

function NASCard({
  item,
  onClick,
  showProgress = false,
  aspectRatio = 'video',
}: {
  item: MediaItem
  onClick: () => void
  showProgress?: boolean
  aspectRatio?: 'video' | 'poster' | 'square'
}) {
  const [imgError, setImgError] = useState(false)

  const aspectClass = aspectRatio === 'poster' ? 'aspect-[2/3]' : aspectRatio === 'square' ? 'aspect-square' : 'aspect-video'
  const widthClass = aspectRatio === 'poster' ? 'w-[140px] sm:w-[160px]' : aspectRatio === 'square' ? 'w-[130px] sm:w-[150px]' : 'w-[220px] sm:w-[260px]'

  const progress = (item as any).userData?.playedPercentage || 0
  const durationLabel = formatDuration(item.duration, item.durationTicks)

  return (
    <button
      onClick={onClick}
      className={cn('group shrink-0 text-left', widthClass)}
    >
      <div className={cn('relative rounded-lg overflow-hidden bg-muted', aspectClass)}>
        {item.thumbnail && !imgError ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <ItemTypeIcon itemType={item.itemType || ''} className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Progress bar for Continue Watching */}
        {showProgress && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* Duration badge */}
        {durationLabel && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            {durationLabel}
          </div>
        )}

        {/* Rating */}
        {item.communityRating != null && item.communityRating > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
            {item.communityRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
          {item.title}
        </p>
        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
          {item.seriesName || item.artist || item.albumArtist || (item.releaseYear > 0 ? String(item.releaseYear) : '')}
        </p>
      </div>
    </button>
  )
}

// ── NAS Library View ───────────────────────────────────────────────────────────

function NASLibraryView({
  library,
  sortBy,
  sortOrder,
  filterGenre,
  filterYear,
  displayMode,
  onSortChange,
  onFilterChange,
  onDisplayModeChange,
  onItemClick,
}: {
  library: JellyfinLibrary
  sortBy: string
  sortOrder: string
  filterGenre: string
  filterYear: string
  displayMode: 'grid' | 'list'
  onSortChange: (sortBy: string, sortOrder: string) => void
  onFilterChange: (genre: string, year: string) => void
  onDisplayModeChange: (mode: 'grid' | 'list') => void
  onItemClick: (item: MediaItem) => void
}) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [startIndex, setStartIndex] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Determine the filter types based on library type
  const getFilterType = (): string => {
    switch (library.collectionType) {
      case 'movies': return 'Movie'
      case 'tvshows': return 'Series'
      case 'music': return 'MusicAlbum'  // Show albums, not individual tracks
      case 'books': return 'Book,AudioBook'
      case 'podcasts': return 'Series,Audio'
      default: return ''
    }
  }

  const fetchItems = useCallback(async (startIdx: number = 0, append: boolean = false) => {
    if (startIdx === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        parentId: library.id,
        sortBy,
        sortOrder,
        limit: '100',
        startIndex: String(startIdx),
      })

      const filterType = getFilterType()
      if (filterType) params.set('filterType', filterType)
      if (filterGenre) params.set('genre', filterGenre)
      if (filterYear) params.set('year', filterYear)

      const res = await fetch(`/api/jellyfin/library-items?${params}`)
      const data = await res.json()

      if (append) {
        setItems((prev) => [...prev, ...(data.items || [])])
      } else {
        setItems(data.items || [])
      }
      setTotalCount(data.totalRecordCount || 0)
      setStartIndex(startIdx)
    } catch (err) {
      console.error('Failed to fetch library items:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [library.id, sortBy, sortOrder, filterGenre, filterYear])

  // Re-fetch when sort/filter changes
  useEffect(() => {
    fetchItems(0, false)
  }, [fetchItems])

  const loadMore = useCallback(() => {
    fetchItems(startIndex + 100, true)
  }, [fetchItems, startIndex])

  const hasMore = items.length < totalCount

  return (
    <div className="space-y-0">
      {/* Library Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br', getLibraryColor(library.collectionType))}>
              <LibraryTypeIcon collectionType={library.collectionType} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{library.name}</h2>
              <p className="text-xs text-muted-foreground">
                {totalCount} item{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort */}
            <Select value={`${sortBy}|${sortOrder}`} onValueChange={(v) => {
              const [by, order] = v.split('|')
              onSortChange(by, order)
            }}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SlidersHorizontal className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value + '|Ascending'} value={`${opt.value}|Ascending`}>
                    {opt.label} ↑
                  </SelectItem>
                ))}
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value + '|Descending'} value={`${opt.value}|Descending`}>
                    {opt.label} ↓
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View mode */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <Button
                variant={displayMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-none"
                onClick={() => onDisplayModeChange('grid')}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={displayMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-none"
                onClick={() => onDisplayModeChange('list')}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Refresh */}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchItems(0, false)}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-4 md:p-6">
          <div className={cn(
            displayMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'space-y-2'
          )}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className={cn(displayMode === 'grid' ? 'aspect-video rounded-lg' : 'h-16 rounded-lg')} />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No items found</p>
          <p className="text-xs mt-1">This library may be empty or your filters may be too restrictive</p>
        </div>
      ) : displayMode === 'grid' ? (
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => {
              const isAlbum = item.itemType === 'MusicAlbum' || item.itemType === 'AudioBook'
              return (
                <NASCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                  aspectRatio={isAlbum ? 'square' : 'poster'}
                />
              )
            })}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="p-4 md:p-6">
          <NASListView items={items} onItemClick={onItemClick} />
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Load More ({items.length} / {totalCount})
          </Button>
        </div>
      )}
    </div>
  )
}

// ── NAS List View ──────────────────────────────────────────────────────────────

function NASListView({ items, onItemClick }: { items: MediaItem[]; onItemClick: (item: MediaItem) => void }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      {items.map((item, index) => {
        const durationLabel = formatDuration(item.duration, item.durationTicks)

        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60 text-left',
              index < items.length - 1 && 'border-b border-border/30'
            )}
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ItemTypeIcon itemType={item.itemType || ''} className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {item.seriesName || item.artist || item.albumArtist || getTypeLabel(item.itemType || '')}
                {item.releaseYear > 0 && ` · ${item.releaseYear}`}
              </p>
            </div>

            {/* Rating */}
            {item.communityRating != null && item.communityRating > 0 && (
              <div className="flex items-center gap-0.5 text-xs shrink-0">
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{item.communityRating.toFixed(1)}</span>
              </div>
            )}

            {/* Duration */}
            {durationLabel && (
              <span className="text-xs text-muted-foreground shrink-0">{durationLabel}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── NAS Item Detail ────────────────────────────────────────────────────────────

function NASItemDetail({
  item,
  onBack,
  onItemClick,
}: {
  item: MediaItem
  onBack: () => void
  onItemClick: (item: MediaItem) => void
}) {
  const { setCurrentMedia, setPlaybackQueue, setDetailPanelItem } = useAppStore()
  const [seasons, setSeasons] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<MediaItem[]>([])
  const [activeSeason, setActiveSeason] = useState(0)
  const [tracks, setTracks] = useState<MediaItem[]>([])
  const [similarItems, setSimilarItems] = useState<MediaItem[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [imageError, setImageError] = useState(false)

  const jellyfinId = item.jellyfinId || item.id.replace('jf-', '')

  // Determine item type
  const isSeries = item.itemType === 'Series' || item.type === 'TV_SHOW'
  const isAlbum = item.itemType === 'MusicAlbum' || item.itemType === 'Audio'
  const isAudioBook = item.itemType === 'AudioBook' || item.type === 'AUDIOBOOK'
  const isPodcast = item.type === 'PODCAST'
  const isCollection = item.itemType === 'BoxSet' || item.type === 'COLLECTION'
  const isMovie = item.itemType === 'Movie'
  const isPlayable = !item.hasChildren || item.itemType === 'Episode' || item.itemType === 'Audio'

  // Fetch detail data
  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true)

      try {
        // Fetch similar items and people in parallel
        const promises: Promise<void>[] = []

        // Similar items
        promises.push(
          fetch(`/api/jellyfin/similar/${jellyfinId}`)
            .then(res => res.ok ? res.json() : { items: [] })
            .then(data => setSimilarItems(data.items || []))
            .catch(() => setSimilarItems([]))
        )

        // People
        promises.push(
          fetch(`/api/jellyfin/people/${jellyfinId}`)
            .then(res => res.ok ? res.json() : { people: [] })
            .then(data => setPeople(data.people || []))
            .catch(() => setPeople([]))
        )

        // Series seasons
        if (isSeries) {
          promises.push(
            fetch(`/api/jellyfin/series?seriesId=${jellyfinId}`)
              .then(res => res.json())
              .then(data => {
                const fetchedSeasons = data.seasons || []
                setSeasons(fetchedSeasons)
                if (fetchedSeasons.length > 0) {
                  const firstSeasonId = fetchedSeasons[0].jellyfinId || fetchedSeasons[0].id
                  return fetch(`/api/jellyfin/series?seasonId=${firstSeasonId}`)
                }
                return null
              })
              .then(res => res ? res.json() : null)
              .then(data => data && setEpisodes(data.episodes || []))
              .catch(() => {})
          )
        }

        // Album tracks
        if (isAlbum || isAudioBook) {
          promises.push(
            fetch(`/api/jellyfin/items?parentId=${jellyfinId}`)
              .then(res => res.json())
              .then(data => setTracks(data.items || []))
              .catch(() => setTracks([]))
          )
        }

        // Collection items
        if (isCollection) {
          promises.push(
            fetch(`/api/jellyfin/collection?collectionId=${jellyfinId}`)
              .then(res => res.json())
              .then(data => setTracks(data.items || []))
              .catch(() => setTracks([]))
          )
        }

        await Promise.allSettled(promises)
      } catch (err) {
        console.error('Failed to fetch detail:', err)
      } finally {
        setLoadingDetail(false)
      }
    }

    fetchDetail()
  }, [jellyfinId, isSeries, isAlbum, isAudioBook, isCollection])

  // Handle season change
  const handleSeasonChange = useCallback(async (seasonIndex: number) => {
    setActiveSeason(seasonIndex)
    const season = seasons[seasonIndex]
    if (!season) return

    const seasonId = season.jellyfinId || season.id
    try {
      const res = await fetch(`/api/jellyfin/series?seasonId=${seasonId}`)
      const data = await res.json()
      setEpisodes(data.episodes || [])
    } catch (err) {
      console.error('Failed to fetch episodes:', err)
    }
  }, [seasons])

  // Play item
  const handlePlay = useCallback(() => {
    if (isAlbum || isAudioBook || isPodcast) {
      if (tracks.length > 0) {
        const queueType = isAudioBook ? 'Audiobook' : isPodcast ? 'Podcast' : 'Album'
        setPlaybackQueue({
          items: tracks,
          currentIndex: 0,
          parentItem: item,
          queueType,
          repeat: 'none',
          shuffle: false,
        })
        setCurrentMedia(tracks[0])
      }
    } else {
      setCurrentMedia(item)
    }
  }, [item, tracks, isAlbum, isAudioBook, isPodcast, setCurrentMedia, setPlaybackQueue])

  // Shuffle play
  const handleShufflePlay = useCallback(() => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      const queueType = isAudioBook ? 'Audiobook' : isPodcast ? 'Podcast' : 'Album'
      setPlaybackQueue({
        items: shuffled,
        currentIndex: 0,
        parentItem: item,
        queueType: `${queueType} (Shuffle)`,
        repeat: 'none',
        shuffle: true,
      })
      setCurrentMedia(shuffled[0])
    }
  }, [tracks, item, isAudioBook, isPodcast, setCurrentMedia, setPlaybackQueue])

  // Play track from index
  const playTrackFromIndex = useCallback((index: number) => {
    if (tracks.length === 0) return
    const queueType = isAudioBook ? 'Audiobook' : isPodcast ? 'Podcast' : 'Album'
    setPlaybackQueue({
      items: tracks,
      currentIndex: index,
      parentItem: item,
      queueType,
      repeat: 'none',
      shuffle: false,
    })
    setCurrentMedia(tracks[index])
  }, [tracks, item, isAudioBook, isPodcast, setCurrentMedia, setPlaybackQueue])

  const durationLabel = formatDuration(item.duration, item.durationTicks)
  const genres = item.genre ? item.genre.split(',').map(g => g.trim()).filter(Boolean) : (item.tags || []).slice(0, 5)

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <div className="relative">
        {/* Backdrop */}
        {item.thumbnail && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-125 opacity-20"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
          </div>
        )}

        <div className="relative p-4 md:p-6 pb-6">
          <div className="flex items-start gap-4 md:gap-6">
            {/* Poster/Album Art */}
            <div className="shrink-0">
              <div className={cn(
                'rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10',
                isAlbum || isAudioBook ? 'w-32 h-32 md:w-40 md:h-40' : 'w-28 h-40 md:w-36 md:h-52'
              )}>
                {item.thumbnail && !imageError ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                    <ItemTypeIcon itemType={item.itemType || ''} className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <Badge variant="outline" className="text-[10px] gap-1 mb-2 font-semibold">
                  <ItemTypeIcon itemType={item.itemType || ''} className="h-2.5 w-2.5" />
                  {getTypeLabel(item.itemType || '')}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{item.title}</h1>
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
                {durationLabel && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{durationLabel}</span>
                  </>
                )}
                {item.communityRating != null && item.communityRating > 0 && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{item.communityRating.toFixed(1)}</span>
                  </>
                )}
                {item.officialRating && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="px-1.5 py-0.5 rounded border border-border/50 text-xs font-medium">{item.officialRating}</span>
                  </>
                )}
                {item.isJellyfin && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold">
                    <Server className="h-2.5 w-2.5" />NAS
                  </Badge>
                )}
              </div>

              {/* Genre tags */}
              {genres.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {genres.slice(0, 6).map((genre) => (
                    <span key={genre} className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted/80 text-muted-foreground border border-border/50">
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Studios */}
              {item.studios && item.studios.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {item.studios.slice(0, 3).join(' · ')}
                </p>
              )}

              {/* Play buttons */}
              <div className="flex items-center gap-2 pt-1">
                {(isPlayable || isAlbum || isAudioBook) && (
                  <Button className="gap-2" onClick={handlePlay}>
                    <Play className="h-4 w-4 fill-current" />
                    {isAlbum ? 'Play Album' : isAudioBook ? 'Play Audiobook' : isSeries ? 'Play First Episode' : 'Play'}
                  </Button>
                )}
                {(isAlbum || isAudioBook) && tracks.length > 1 && (
                  <Button variant="secondary" className="gap-2" onClick={handleShufflePlay}>
                    <Shuffle className="h-4 w-4" />
                    Shuffle
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDetailPanelItem(item)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  More Info
                </Button>
              </div>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Season Tabs (for Series) */}
      {isSeries && seasons.length > 0 && (
        <div className="px-4 md:px-6">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin">
            {seasons.map((season, index) => (
              <button
                key={season.id || season.jellyfinId}
                onClick={() => handleSeasonChange(index)}
                className={cn(
                  'shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200',
                  activeSeason === index
                    ? 'text-primary bg-muted/80 border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                {season.title || season.name || `Season ${season.indexNumber || index + 1}`}
                {season.childCount > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                    ({season.childCount})
                  </span>
                )}
              </button>
            ))}
          </div>
          <Separator />
        </div>
      )}

      {/* Episodes (for Series) */}
      {isSeries && (
        <div className="p-4 md:p-6">
          {loadingDetail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/40">
                  <Skeleton className="aspect-video w-full rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {episodes.map((ep) => {
                const epDuration = formatDuration(ep.duration, ep.durationTicks)
                const epNum = ep.episodeNumber ?? ep.indexNumber
                const seasonNum = ep.seasonNumber ?? ep.parentIndexNumber
                return (
                  <button
                    key={ep.id}
                    onClick={() => setCurrentMedia(ep)}
                    className="group rounded-xl border border-border/40 overflow-hidden hover:ring-2 hover:ring-primary/30 hover:shadow-lg transition-all duration-200 text-left"
                  >
                    <div className="relative aspect-video bg-muted">
                      {ep.thumbnail ? (
                        <img src={ep.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tv className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                      )}
                      {epNum != null && (
                        <div className="absolute top-2 left-2 bg-black/75 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                          {epNum}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30">
                            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      {epDuration && (
                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {epDuration}
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">{ep.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {seasonNum != null && epNum != null && <span className="font-medium text-emerald-600 dark:text-emerald-400">S{seasonNum}E{epNum}</span>}
                        {epDuration && <><span className="text-muted-foreground/30">·</span><span>{epDuration}</span></>}
                        {ep.communityRating != null && ep.communityRating > 0 && (
                          <><span className="text-muted-foreground/30">·</span><span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />{ep.communityRating.toFixed(1)}</span></>
                        )}
                      </div>
                      {ep.description && <p className="text-xs text-muted-foreground/70 line-clamp-2">{ep.description}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Tv className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No episodes in this season</p>
            </div>
          )}
        </div>
      )}

      {/* Track List (for Albums/Audiobooks/Podcasts) */}
      {(isAlbum || isAudioBook || isPodcast) && (
        <div className="p-4 md:p-6">
          {loadingDetail ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <>
              {/* Play controls */}
              <div className="flex items-center gap-3 mb-4">
                <Button className="gap-2" onClick={() => playTrackFromIndex(0)}>
                  <Play className="h-4 w-4 fill-current" />
                  Play All
                </Button>
                <Button variant="secondary" className="gap-2" onClick={handleShufflePlay}>
                  <Shuffle className="h-4 w-4" />
                  Shuffle
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                  {(() => {
                    const total = tracks.reduce((s, t) => s + (t.durationTicks || 0), 0)
                    const dur = formatDuration(undefined, total)
                    return dur ? ` · ${dur}` : ''
                  })()}
                </span>
              </div>

              {/* Track list */}
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {tracks.map((track, index) => {
                  const trackDur = track.durationTicks ? formatDurationShort(track.durationTicks) : track.duration
                  const trackNum = track.indexNumber ?? track.episodeNumber ?? index + 1

                  return (
                    <button
                      key={track.id}
                      onClick={() => playTrackFromIndex(index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 text-left',
                        index < tracks.length - 1 && 'border-b border-border/20'
                      )}
                    >
                      <span className="w-7 shrink-0 text-center text-xs font-medium text-muted-foreground tabular-nums">
                        {trackNum}
                      </span>
                      {track.thumbnail && (
                        <div className="w-9 h-9 rounded overflow-hidden shrink-0">
                          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        {track.artist && track.artist !== item.artist && (
                          <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                        )}
                      </div>
                      {trackDur && (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{trackDur}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Music className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No tracks found</p>
            </div>
          )}
        </div>
      )}

      {/* Collection Items */}
      {isCollection && (
        <div className="p-4 md:p-6">
          {loadingDetail ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tracks.map((collItem) => (
                <NASCard
                  key={collItem.id}
                  item={collItem}
                  onClick={() => onItemClick(collItem)}
                  aspectRatio="poster"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Library className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No items in this collection</p>
            </div>
          )}
        </div>
      )}

      {/* People/Cast */}
      {people.length > 0 && (
        <div className="px-4 md:px-6 pb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            Cast & Crew
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
            {people.slice(0, 15).map((person: any) => (
              <button
                key={person.id}
                onClick={() => setDetailPanelItem(item)} // Open detail panel for more info
                className="flex flex-col items-center gap-2 min-w-[80px] group"
              >
                <Avatar className="h-16 w-16 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                  {person.imageUrl && (
                    <AvatarImage src={person.imageUrl} alt={person.name} />
                  )}
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-[10px] font-semibold truncate w-[80px]">{person.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate w-[80px]">{person.role || person.type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Similar Items */}
      {similarItems.length > 0 && (
        <div className="px-4 md:px-6 pb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Similar
          </h2>
          <NASCarousel items={similarItems} onItemClick={onItemClick} />
        </div>
      )}
    </div>
  )
}

// ── NAS Search View ────────────────────────────────────────────────────────────

function NASSearchView({
  query,
  onItemClick,
}: {
  query: string
  onItemClick: (item: MediaItem) => void
}) {
  const [results, setResults] = useState<MediaItem[]>([])
  const [groups, setGroups] = useState<Record<string, MediaItem[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!query) return

    const search = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/jellyfin/search-nas?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.items || [])
          setGroups(data.groups || {})
        }
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }

    search()
  }, [query])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Searching NAS for "{query}"...</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">No results for "{query}"</p>
        <p className="text-xs mt-1">Try a different search term</p>
      </div>
    )
  }

  const groupLabels: Record<string, string> = {
    MOVIE: 'Movies',
    TV_SHOW: 'TV Shows',
    MUSIC: 'Music',
    AUDIOBOOK: 'Audiobooks',
    BOOK: 'Books',
    COLLECTION: 'Collections',
    PODCAST: 'Podcasts',
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</p>

      {/* Grouped results */}
      {Object.entries(groups).map(([type, items]) => (
        <section key={type}>
          <h2 className="text-base font-bold mb-3">{groupLabels[type] || type}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => (
              <NASCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                aspectRatio={item.itemType === 'MusicAlbum' || item.itemType === 'AudioBook' ? 'square' : 'poster'}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Home Skeleton ──────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="p-6 space-y-8">
      {/* Libraries */}
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 p-4">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="shrink-0 w-[220px] space-y-2">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
