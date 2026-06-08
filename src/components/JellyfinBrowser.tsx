'use client'

import { useAppStore } from '@/store/useAppStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronRight,
  Server,
  FolderOpen,
  Film,
  Tv,
  Music,
  Mic,
  Headphones,
  Layers,
  RefreshCw,
  Settings,
  Play,
  ArrowLeft,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  Search,
  Star,
  Calendar,
  SortAsc,
  List,
  Grid3X3,
  Disc3,
  BookOpen,
  Info,
  Users,
  ExternalLink,
  Pause,
} from 'lucide-react'
import { useEffect, useCallback, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const collectionGradients: Record<string, string> = {
  movies: 'from-red-600/90 via-red-800/70 to-red-950/90',
  tvshows: 'from-emerald-600/90 via-emerald-800/70 to-emerald-950/90',
  music: 'from-purple-600/90 via-purple-800/70 to-purple-950/90',
  podcasts: 'from-amber-600/90 via-amber-800/70 to-amber-950/90',
  books: 'from-teal-600/90 via-teal-800/70 to-teal-950/90',
  boxsets: 'from-orange-600/90 via-orange-800/70 to-orange-950/90',
  homevideos: 'from-rose-600/90 via-rose-800/70 to-rose-950/90',
}

const collectionIcons: Record<string, React.ElementType> = {
  movies: Film,
  tvshows: Tv,
  music: Music,
  podcasts: Mic,
  books: Headphones,
  boxsets: Layers,
  homevideos: Film,
}

const collectionAccentColors: Record<string, string> = {
  movies: 'text-red-400',
  tvshows: 'text-emerald-400',
  music: 'text-purple-400',
  podcasts: 'text-amber-400',
  books: 'text-teal-400',
  boxsets: 'text-orange-400',
  homevideos: 'text-rose-400',
}

const typeColors: Record<string, string> = {
  MOVIE: 'bg-red-500/10 text-red-500 border-red-500/20',
  TV_SHOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  MUSIC: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  PODCAST: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  AUDIOBOOK: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  COLLECTION: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
}

const itemTypeLabels: Record<string, string> = {
  CollectionFolder: 'Library',
  UserView: 'Library',
  Series: 'TV Series',
  Season: 'Season',
  Episode: 'Episode',
  Movie: 'Movie',
  Audio: 'Track',
  MusicAlbum: 'Album',
  MusicArtist: 'Artist',
  AudioBook: 'Audiobook',
  BoxSet: 'Collection',
}

const typeLabels: Record<string, string> = {
  MOVIE: 'Movie',
  TV_SHOW: 'TV Show',
  MUSIC: 'Music',
  PODCAST: 'Podcast',
  AUDIOBOOK: 'Audiobook',
  COLLECTION: 'Collection',
}

type SortOption = 'SortName' | 'DateCreated' | 'CommunityRating' | 'ProductionYear'
type ViewMode = 'grid' | 'list'

const sortLabels: Record<SortOption, string> = {
  SortName: 'Name',
  DateCreated: 'Date Added',
  CommunityRating: 'Rating',
  ProductionYear: 'Year',
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function JellyfinBrowser() {
  const {
    jellyfinConnected,
    setJellyfinConnected,
    jellyfinServer,
    setJellyfinServer,
    jellyfinItems,
    setJellyfinItems,
    jellyfinLoading,
    setJellyfinLoading,
    jellyfinBreadcrumbs,
    setJellyfinBreadcrumbs,
    setSettingsOpen,
  } = useAppStore()

  const [serverInfo, setServerInfo] = useState<{
    serverName: string
    version: string
  } | null>(null)
  const [latestItems, setLatestItems] = useState<any[]>([])
  const [latestLoading, setLatestLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('SortName')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [detailItem, setDetailItem] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // --- Fetch helpers ---

  const fetchLibraries = useCallback(async () => {
    setJellyfinLoading(true)
    try {
      const res = await fetch('/api/jellyfin/libraries')
      const data = await res.json()
      setJellyfinItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch Jellyfin libraries:', err)
    } finally {
      setJellyfinLoading(false)
    }
  }, [setJellyfinItems, setJellyfinLoading])

  const currentCollectionTypeRef = useCallback(() => {
    for (const item of jellyfinItems) {
      if (item.collectionType) return item.collectionType
    }
    return ''
  }, [jellyfinItems])

  const fetchItems = useCallback(async (parentId: string, collectionType?: string) => {
    setJellyfinLoading(true)
    try {
      const params = new URLSearchParams({ parentId })
      if (collectionType) params.set('collectionType', collectionType)
      const res = await fetch(`/api/jellyfin/items?${params}`)
      const data = await res.json()
      setJellyfinItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch Jellyfin items:', err)
    } finally {
      setJellyfinLoading(false)
    }
  }, [setJellyfinItems, setJellyfinLoading])

  const fetchLatest = useCallback(async () => {
    setLatestLoading(true)
    try {
      const res = await fetch('/api/jellyfin/category?type=MOVIE&limit=12')
      const data = await res.json()
      setLatestItems(data.items || [])
    } catch {
      // Non-critical
    } finally {
      setLatestLoading(false)
    }
  }, [])

  const fetchServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/jellyfin/status')
      const data = await res.json()
      if (data.connected) {
        setJellyfinConnected(true)
        if (data.server) setJellyfinServer(data.server)
        if (data.serverInfo) {
          setServerInfo(data.serverInfo)
        }
      } else {
        setJellyfinConnected(false)
      }
    } catch {
      setJellyfinConnected(false)
    }
  }, [setJellyfinConnected, setJellyfinServer])

  // --- Search within Jellyfin ---

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jellyfin/items?search=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSearchResults(data.items || [])
      } catch (err) {
        console.error('Search failed:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [])

  // --- Detail view ---

  const fetchDetail = useCallback(async (itemId: string) => {
    setDetailLoading(true)
    setDetailItem(null)
    try {
      const res = await fetch(`/api/jellyfin/details/${itemId}`)
      const data = await res.json()
      setDetailItem(data)
    } catch (err) {
      console.error('Failed to fetch item details:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // --- Retry connection ---

  const retryConnection = useCallback(async () => {
    setRetrying(true)
    try {
      const res = await fetch('/api/jellyfin/auto-connect', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setJellyfinConnected(true)
          if (data.server) setJellyfinServer(data.server)
          await fetchServerStatus()
        }
      }
    } catch (err) {
      console.error('Retry connection failed:', err)
    } finally {
      setRetrying(false)
    }
  }, [setJellyfinConnected, setJellyfinServer, fetchServerStatus])

  // --- Effects ---

  useEffect(() => {
    if (jellyfinConnected && jellyfinBreadcrumbs.length === 0 && !detailItem) {
      fetchLibraries()
    }
  }, [jellyfinConnected, jellyfinBreadcrumbs.length, fetchLibraries, detailItem])

  useEffect(() => {
    if (jellyfinConnected && jellyfinBreadcrumbs.length === 0 && !detailItem) {
      fetchLatest()
    }
  }, [jellyfinConnected, jellyfinBreadcrumbs.length, fetchLatest, detailItem])

  useEffect(() => {
    if (jellyfinConnected && !serverInfo) {
      fetchServerStatus()
    }
  }, [jellyfinConnected, serverInfo, fetchServerStatus])

  // --- Navigation ---

  const handleNavigate = (item: any) => {
    // If item is a Series/Season/MusicAlbum/BoxSet, show detail view
    if (
      item.itemType === 'Series' ||
      item.itemType === 'MusicAlbum' ||
      item.itemType === 'MusicArtist' ||
      item.itemType === 'BoxSet'
    ) {
      const jellyfinId = item.jellyfinId || item.id
      setJellyfinBreadcrumbs([
        ...jellyfinBreadcrumbs,
        { id: item.id, title: item.title, collectionType: item.collectionType || currentCollectionTypeRef() },
      ])
      fetchDetail(jellyfinId.replace('jf-', ''))
      return
    }

    if (item.hasChildren) {
      const ct = item.collectionType || currentCollectionTypeRef()
      setJellyfinBreadcrumbs([...jellyfinBreadcrumbs, { id: item.id, title: item.title, collectionType: ct }])
      fetchItems(item.id, ct)
      setDetailItem(null)
    } else {
      const ct = currentCollectionTypeRef()
      let itemType = item.type
      if (ct === 'podcasts' && item.type === 'MUSIC') itemType = 'PODCAST'
      if (ct === 'books' && item.type === 'MUSIC') itemType = 'AUDIOBOOK'

      useAppStore.setState({
        currentMedia: {
          ...item,
          type: itemType,
          collectionType: ct,
        },
        isPlaying: true,
      })
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = jellyfinBreadcrumbs.slice(0, index + 1)
    setJellyfinBreadcrumbs(newBreadcrumbs)
    setDetailItem(null)
    setSearchQuery('')
    setSearchResults([])
    const target = newBreadcrumbs[index]
    fetchItems(target.id, (target as any).collectionType || '')
  }

  const handleBackToRoot = () => {
    setJellyfinBreadcrumbs([])
    setDetailItem(null)
    setSearchQuery('')
    setSearchResults([])
    fetchLibraries()
  }

  const handleBackOneLevel = () => {
    if (detailItem && jellyfinBreadcrumbs.length > 0) {
      // Going back from detail view
      setDetailItem(null)
      if (jellyfinBreadcrumbs.length === 1) {
        // Was viewing detail from library root, go back to library items
        const crumb = jellyfinBreadcrumbs[jellyfinBreadcrumbs.length - 1]
        // Remove the detail crumb
        setJellyfinBreadcrumbs(jellyfinBreadcrumbs.slice(0, -1))
        // Re-fetch the library items (we need the parentId)
        fetchItems(crumb.id, crumb.collectionType || '')
      } else {
        // Go back to previous breadcrumb level
        const newBreadcrumbs = jellyfinBreadcrumbs.slice(0, -1)
        setJellyfinBreadcrumbs(newBreadcrumbs)
        if (newBreadcrumbs.length === 0) {
          fetchLibraries()
        } else {
          const target = newBreadcrumbs[newBreadcrumbs.length - 1]
          fetchItems(target.id, (target as any).collectionType || '')
        }
      }
    } else if (jellyfinBreadcrumbs.length <= 1) {
      handleBackToRoot()
    } else {
      handleBreadcrumbClick(jellyfinBreadcrumbs.length - 2)
    }
  }

  // --- Play helpers ---

  const handlePlayItem = (item: any, collectionType?: string) => {
    const ct = collectionType || currentCollectionTypeRef()
    let itemType = item.type
    if (ct === 'podcasts' && item.type === 'MUSIC') itemType = 'PODCAST'
    if (ct === 'books' && item.type === 'MUSIC') itemType = 'AUDIOBOOK'

    useAppStore.setState({
      currentMedia: {
        ...item,
        type: itemType,
        collectionType: ct,
      },
      isPlaying: true,
    })
  }

  const handlePlayDetailItem = () => {
    if (!detailItem) return
    const ct = currentCollectionTypeRef()

    // For Series, play the first episode
    if (detailItem.type === 'Series' && detailItem.episodes?.length > 0) {
      const ep = detailItem.episodes[0]
      handlePlayItem({
        id: `jf-${ep.id}`,
        title: ep.name,
        description: ep.overview,
        type: 'TV_SHOW',
        thumbnail: ep.thumbnail,
        videoUrl: '',
        duration: ep.duration,
        releaseYear: 0,
        artist: '',
        views: 0,
        channel: '',
        isJellyfin: true,
        jellyfinId: ep.id,
        mediaSourceId: ep.mediaSourceId,
        itemType: 'Episode',
        hasChildren: false,
        indexNumber: ep.indexNumber,
        parentIndexNumber: ep.parentIndexNumber,
      }, ct)
      return
    }

    // For MusicAlbum, play all tracks as queue
    if (detailItem.type === 'MusicAlbum' && detailItem.podcastEpisodes?.length > 0) {
      const tracks = detailItem.podcastEpisodes.map((ep: any) => ({
        id: `jf-${ep.id}`,
        title: ep.name,
        description: ep.overview || '',
        type: ct === 'podcasts' ? 'PODCAST' : 'MUSIC',
        genre: '',
        thumbnail: ep.thumbnail || `/api/jellyfin/image/${detailItem.id}`,
        videoUrl: '',
        duration: ep.duration,
        releaseYear: ep.productionYear || 0,
        artist: ep.artists?.join(', ') || '',
        views: 0,
        channel: '',
        isJellyfin: true,
        jellyfinId: ep.id,
        mediaSourceId: ep.mediaSourceId,
        itemType: 'Audio',
        hasChildren: false,
        indexNumber: ep.indexNumber,
        collectionType: ct,
      }))

      useAppStore.setState({
        audioQueue: tracks,
        audioQueueIndex: 0,
        currentMedia: tracks[0],
        audioTrack: tracks[0],
        isPlaying: true,
      })
      return
    }

    // For single playable items
    handlePlayItem({
      id: `jf-${detailItem.id}`,
      title: detailItem.name,
      description: detailItem.overview,
      type: detailItem.type === 'Movie' ? 'MOVIE' : detailItem.type === 'AudioBook' ? 'AUDIOBOOK' : 'MOVIE',
      thumbnail: detailItem.imageTags?.Primary
        ? `/api/jellyfin/image/${detailItem.id}?tag=${detailItem.imageTags.Primary}`
        : '',
      videoUrl: '',
      duration: detailItem.runtime,
      releaseYear: detailItem.productionYear || 0,
      artist: '',
      views: 0,
      channel: '',
      isJellyfin: true,
      jellyfinId: detailItem.id,
      mediaSourceId: '',
      itemType: detailItem.type,
      hasChildren: false,
      communityRating: detailItem.communityRating,
    }, ct)
  }

  // --- Sorted items ---
  const sortedItems = [...jellyfinItems].sort((a, b) => {
    switch (sortBy) {
      case 'SortName':
        return a.title.localeCompare(b.title)
      case 'DateCreated':
        return (b.releaseYear || 0) - (a.releaseYear || 0)
      case 'CommunityRating':
        return (b.communityRating || 0) - (a.communityRating || 0)
      case 'ProductionYear':
        return (b.releaseYear || 0) - (a.releaseYear || 0)
      default:
        return 0
    }
  })

  // --- Determine current view ---
  const isAtRoot = jellyfinBreadcrumbs.length === 0 && !detailItem
  const isDetailView = !!detailItem

  // =====================================================================
  // DISCONNECTED STATE
  // =====================================================================

  if (!jellyfinConnected) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center text-center gap-6 pt-8 pb-8">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
                <Server className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-destructive/20 border-2 border-background flex items-center justify-center">
                <WifiOff className="h-3 w-3 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Jellyfin NAS</h2>
              <Badge variant="outline" className="text-xs gap-1.5 text-destructive border-destructive/30 bg-destructive/10">
                <WifiOff className="h-3 w-3" />
                Not Connected
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open Settings to connect to your Jellyfin server and access your personal media library.
            </p>
            <div className="flex flex-col w-full gap-3">
              <Button className="w-full gap-2" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
                Open Settings
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={retryConnection}
                disabled={retrying}
              >
                <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} />
                {retrying ? 'Connecting...' : 'Retry Connection'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =====================================================================
  // LOADING STATE
  // =====================================================================

  if (jellyfinLoading && !detailItem) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-20" />
        </div>
        {isAtRoot ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[200px] space-y-2">
                  <Skeleton className="aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // =====================================================================
  // CONNECTED & ROOT VIEW (Library overview)
  // =====================================================================

  if (isAtRoot) {
    const libraryCards = jellyfinItems.filter(
      (item) => item.itemType === 'CollectionFolder' || item.itemType === 'UserView'
    )

    return (
      <div className="p-4 md:p-6 space-y-8">
        {/* ---- Header Bar ---- */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">
                {serverInfo?.serverName || jellyfinServer?.name || 'Jellyfin NAS'}
              </h1>
              {serverInfo?.version && (
                <p className="text-xs text-muted-foreground">v{serverInfo.version}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
              <Wifi className="h-3 w-3" />
              Connected
            </Badge>
          </div>
        </div>

        {/* ---- Search Bar ---- */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            </div>
          )}
        </div>

        {/* ---- Search Results ---- */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              Search Results
              <Badge variant="secondary" className="text-xs">{searchResults.length}</Badge>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {searchResults.map((item) => (
                <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
              ))}
            </div>
          </section>
        )}

        {/* ---- Search Empty State ---- */}
        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {/* ---- Hide library content while searching ---- */}
        {!searchQuery.trim() && (
          <>
            {/* ---- Continue Watching ---- */}
            <ContinueWatchingSection onNavigate={handleNavigate} />

            {/* ---- Large Library Cards ---- */}
            {libraryCards.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  Your Libraries
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraryCards.map((lib) => (
                    <LibraryCard key={lib.id} item={lib} onNavigate={handleNavigate} />
                  ))}
                </div>
              </section>
            )}

            {/* ---- Recently Added ---- */}
            {(latestItems.length > 0 || latestLoading) && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Recently Added
                </h2>
                {latestLoading ? (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-[160px] sm:w-[200px] space-y-2">
                        <Skeleton className="aspect-video rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
                      {latestItems.map((item) => (
                        <div
                          key={item.id}
                          className="shrink-0 w-[160px] sm:w-[200px] group cursor-pointer"
                          onClick={() => handleNavigate(item)}
                        >
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                                <Film className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                  <Play className="h-5 w-5 text-white ml-0.5" />
                                </div>
                              </div>
                            </div>
                          </div>
                          <h3 className="font-medium text-sm mt-2 line-clamp-1 group-hover:text-primary transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.releaseYear > 0 ? item.releaseYear : ''}{item.releaseYear > 0 && item.artist ? ' - ' : ''}{item.artist}
                          </p>
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </section>
            )}

            {/* ---- Non-library items ---- */}
            {jellyfinItems.filter((item) => item.itemType !== 'CollectionFolder' && item.itemType !== 'UserView').length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Browse</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {jellyfinItems
                    .filter((item) => item.itemType !== 'CollectionFolder' && item.itemType !== 'UserView')
                    .map((item) => (
                      <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
                    ))}
                </div>
              </section>
            )}

            {/* ---- Empty state ---- */}
            {libraryCards.length === 0 && !jellyfinLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No libraries found</p>
                <p className="text-sm mt-1">Your Jellyfin server may not have any libraries configured</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // =====================================================================
  // ITEM DETAIL VIEW (Series / Music Album / BoxSet)
  // =====================================================================

  if (isDetailView) {
    return (
      <div className="p-4 md:p-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground mb-4"
          onClick={handleBackOneLevel}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Breadcrumbs */}
        <BreadcrumbBar
          breadcrumbs={jellyfinBreadcrumbs}
          onRootClick={handleBackToRoot}
          onCrumbClick={handleBreadcrumbClick}
        />

        {detailLoading ? (
          <div className="space-y-6 mt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Skeleton className="w-full md:w-64 aspect-[2/3] rounded-xl" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        ) : (
          <DetailContent
            item={detailItem}
            onPlay={handlePlayDetailItem}
            onNavigate={handleNavigate}
            onPlayTrack={(track: any) => handlePlayItem(track, detailItem.type === 'MusicAlbum' ? 'music' : currentCollectionTypeRef())}
          />
        )}
      </div>
    )
  }

  // =====================================================================
  // LIBRARY VIEW (Inside a library/folder)
  // =====================================================================

  return (
    <div className="p-4 md:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground mb-4"
        onClick={handleBackOneLevel}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Breadcrumbs */}
      <BreadcrumbBar
        breadcrumbs={jellyfinBreadcrumbs}
        onRootClick={handleBackToRoot}
        onCrumbClick={handleBreadcrumbClick}
      />

      {/* Title + Search + Sort/Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 mb-6">
        <h1 className="text-xl font-bold truncate">
          {jellyfinBreadcrumbs[jellyfinBreadcrumbs.length - 1]?.title || 'Library'}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search within library */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 h-8 w-[160px] sm:w-[200px] text-sm bg-background/50"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SortAsc className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0 rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0 rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search results or library items */}
      {searchQuery.trim() && searchResults.length > 0 ? (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4'
          : 'space-y-3'
        }>
          {searchResults.map((item) =>
            viewMode === 'grid' ? (
              <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
            ) : (
              <JellyfinListItem key={item.id} item={item} onNavigate={handleNavigate} />
            )
          )}
        </div>
      ) : searchQuery.trim() && !isSearching && searchResults.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : jellyfinItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No content found</p>
          <p className="text-sm mt-1">This library may be empty</p>
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4'
          : 'space-y-3'
        }>
          {(searchQuery.trim() ? searchResults : sortedItems).map((item) =>
            viewMode === 'grid' ? (
              <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
            ) : (
              <JellyfinListItem key={item.id} item={item} onNavigate={handleNavigate} />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BreadcrumbBar — Navigation breadcrumbs
// ---------------------------------------------------------------------------

interface BreadcrumbBarProps {
  breadcrumbs: { id: string; title: string; collectionType?: string }[]
  onRootClick: () => void
  onCrumbClick: (index: number) => void
}

function BreadcrumbBar({ breadcrumbs, onRootClick, onCrumbClick }: BreadcrumbBarProps) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap" aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-muted-foreground hover:text-foreground"
        onClick={onRootClick}
      >
        Libraries
      </Button>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.id} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2',
              index === breadcrumbs.length - 1
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onCrumbClick(index)}
          >
            {crumb.title}
          </Button>
        </div>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// LibraryCard — Large tile for top-level libraries
// ---------------------------------------------------------------------------

interface LibraryCardProps {
  item: any
  onNavigate: (item: any) => void
}

function LibraryCard({ item, onNavigate }: LibraryCardProps) {
  const collectionType = item.collectionType || ''
  const gradient = collectionGradients[collectionType] || 'from-slate-600/90 via-slate-800/70 to-slate-950/90'
  const IconComponent = collectionIcons[collectionType] || FolderOpen
  const accentColor = collectionAccentColors[collectionType] || 'text-slate-400'

  return (
    <Card
      className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-transparent hover:scale-[1.02]"
      onClick={() => onNavigate(item)}
    >
      <div
        className={cn(
          'relative h-40 sm:h-44 rounded-2xl bg-gradient-to-br p-5 flex flex-col justify-between overflow-hidden',
          gradient
        )}
      >
        {/* Decorative circles */}
        <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -right-2 -top-2 h-20 w-20 rounded-full bg-white/5" />
        <div className="absolute left-1/2 bottom-0 h-24 w-24 rounded-full bg-white/3 -translate-x-1/2" />

        {/* Top row: icon + item count */}
        <div className="flex items-start justify-between relative z-10">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <IconComponent className={cn('h-6 w-6', accentColor)} />
          </div>
          {item.childCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 bg-black/30 border-white/10 text-white/80"
            >
              {item.childCount} items
            </Badge>
          )}
        </div>

        {/* Bottom: library name */}
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white leading-tight">
            {item.title}
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            {typeLabels[item.type] || itemTypeLabels[item.itemType] || 'Library'}
          </p>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <ChevronRight className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// JellyfinCard — Compact card for grid browsing
// ---------------------------------------------------------------------------

interface JellyfinCardProps {
  item: any
  onNavigate: (item: any) => void
}

function JellyfinCard({ item, onNavigate }: JellyfinCardProps) {
  const ItemIcon = item.type === 'MOVIE' ? Film
    : item.type === 'TV_SHOW' ? Tv
    : item.type === 'MUSIC' ? Music
    : item.type === 'PODCAST' ? Mic
    : item.type === 'AUDIOBOOK' ? Headphones
    : item.type === 'COLLECTION' ? Layers
    : FolderOpen

  // Use poster aspect ratio for movies/series, square for music, 16:9 for episodes
  const aspectClass = (item.itemType === 'Episode')
    ? 'aspect-video'
    : (item.type === 'MUSIC' || item.itemType === 'MusicAlbum' || item.itemType === 'Audio')
      ? 'aspect-square'
      : 'aspect-[2/3]'

  return (
    <div
      className="group cursor-pointer transition-all duration-200 hover:scale-[1.02]"
      onClick={() => onNavigate(item)}
    >
      {/* Thumbnail */}
      <div className={cn('relative rounded-xl overflow-hidden bg-muted', aspectClass)}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            {item.hasChildren ? (
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
            ) : (
              <ItemIcon className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
        )}

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            {item.duration}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-1.5 left-1.5">
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1.5 py-0 h-4 backdrop-blur-sm", typeColors[item.type] || 'bg-muted text-muted-foreground')}
          >
            {item.hasChildren ? (itemTypeLabels[item.itemType] || item.itemType) : (typeLabels[item.type] || itemTypeLabels[item.itemType] || item.type)}
          </Badge>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {item.hasChildren ? (
              <div className="w-11 h-11 bg-black/70 rounded-full flex items-center justify-center">
                <ChevronRight className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="w-11 h-11 bg-primary/90 rounded-full flex items-center justify-center">
                <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
              </div>
            )}
          </div>
        </div>

        {/* Child count */}
        {item.childCount > 0 && item.hasChildren && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {item.childCount} items
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
          {item.communityRating && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {item.communityRating.toFixed(1)}
              </span>
            </>
          )}
          {item.indexNumber && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>E{item.indexNumber}</span>
            </>
          )}
        </div>
        {item.artist && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.artist}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JellyfinListItem — List view for items
// ---------------------------------------------------------------------------

interface JellyfinListItemProps {
  item: any
  onNavigate: (item: any) => void
}

function JellyfinListItem({ item, onNavigate }: JellyfinListItemProps) {
  const ItemIcon = item.type === 'MOVIE' ? Film
    : item.type === 'TV_SHOW' ? Tv
    : item.type === 'MUSIC' ? Music
    : item.type === 'PODCAST' ? Mic
    : item.type === 'AUDIOBOOK' ? Headphones
    : item.type === 'COLLECTION' ? Layers
    : FolderOpen

  return (
    <div
      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors duration-150"
      onClick={() => onNavigate(item)}
    >
      {/* Thumbnail */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <ItemIcon className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {item.hasChildren ? (
              <ChevronRight className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white ml-0.5" />
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {item.itemType && (
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", typeColors[item.type] || 'bg-muted text-muted-foreground')}>
              {itemTypeLabels[item.itemType] || item.itemType}
            </Badge>
          )}
          {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
          {item.communityRating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              {item.communityRating.toFixed(1)}
            </span>
          )}
        </div>
        {item.artist && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.artist}</p>
        )}
      </div>

      {/* Duration / actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.duration && (
          <span className="text-xs text-muted-foreground">{item.duration}</span>
        )}
        {item.childCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {item.childCount}
          </Badge>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DetailContent — Detailed view for Series/Album/BoxSet
// ---------------------------------------------------------------------------

interface DetailContentProps {
  item: any
  onPlay: () => void
  onNavigate: (item: any) => void
  onPlayTrack: (track: any) => void
}

function DetailContent({ item, onPlay, onNavigate, onPlayTrack }: DetailContentProps) {
  // Derive the initial season id from the data instead of using an effect
  const initialSeasonId = item.type === 'Series' && item.seasons?.length > 0 ? item.seasons[0].id : null
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(initialSeasonId)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loadedSeasonId, setLoadedSeasonId] = useState<string | null>(initialSeasonId)

  // Derive loading state from whether the selected season matches the loaded season
  const episodesLoading = item.type === 'Series' && selectedSeasonId !== null && selectedSeasonId !== loadedSeasonId

  const thumbnail = item.imageTags?.Primary
    ? `/api/jellyfin/image/${item.id}?tag=${item.imageTags.Primary}`
    : ''

  // Fetch episodes when season changes — all setState calls are in async callbacks
  useEffect(() => {
    if (item.type === 'Series' && selectedSeasonId) {
      fetch(`/api/jellyfin/details/${item.id}?seasonId=${selectedSeasonId}`)
        .then(res => res.json())
        .then(data => {
          setEpisodes(data.episodes || [])
          setLoadedSeasonId(selectedSeasonId)
        })
        .catch(() => {
          setEpisodes([])
          setLoadedSeasonId(selectedSeasonId)
        })
    }
  }, [item.id, item.type, selectedSeasonId])

  // ---- Series View ----
  if (item.type === 'Series') {
    const currentEpisodes = selectedSeasonId ? episodes : (item.episodes || [])

    return (
      <div className="space-y-6 mt-6">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="shrink-0 w-full md:w-56">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted">
              {thumbnail ? (
                <img src={thumbnail} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/30 to-emerald-950/50">
                  <Tv className="h-16 w-16 text-emerald-500/30" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{item.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-muted-foreground">
                {item.productionYear && <span>{item.productionYear}</span>}
                {item.status && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <Badge variant="outline" className="text-xs">{item.status}</Badge>
                  </>
                )}
                {item.communityRating && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      {item.communityRating.toFixed(1)}
                    </span>
                  </>
                )}
                {item.cumulativeRuntime && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.cumulativeRuntime}</span>
                  </>
                )}
                {item.totalSeasonCount > 0 && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.totalSeasonCount} Season{item.totalSeasonCount > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            </div>

            {/* Genres */}
            {item.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.genres.map((genre: string) => (
                  <Badge key={genre} variant="secondary" className="text-xs">{genre}</Badge>
                ))}
              </div>
            )}

            {/* Overview */}
            {item.overview && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                {item.overview}
              </p>
            )}

            {/* Play button */}
            <Button size="lg" className="gap-2" onClick={onPlay}>
              <Play className="h-5 w-5" />
              Play
            </Button>

            {/* External links */}
            {item.externalUrls?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {item.externalUrls.map((url: { name: string; url: string }) => (
                  <Button key={url.name} variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                    <a href={url.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      {url.name}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seasons & Episodes */}
        {item.seasons?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Episodes</h2>
              <Select
                value={selectedSeasonId || undefined}
                onValueChange={setSelectedSeasonId}
              >
                <SelectTrigger size="sm" className="w-[160px]">
                  <SelectValue placeholder="Select Season" />
                </SelectTrigger>
                <SelectContent>
                  {item.seasons.map((season: any) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} ({season.episodeCount} eps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {episodesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-40 aspect-video rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : currentEpisodes.length > 0 ? (
              <div className="space-y-2">
                {currentEpisodes.map((ep: any) => (
                  <EpisodeRow key={ep.id} episode={ep} onPlay={() => {
                    onPlayTrack({
                      id: `jf-${ep.id}`,
                      title: ep.name,
                      description: ep.overview,
                      type: 'TV_SHOW',
                      genre: '',
                      thumbnail: ep.thumbnail,
                      videoUrl: '',
                      duration: ep.duration,
                      releaseYear: 0,
                      artist: '',
                      views: 0,
                      channel: '',
                      isJellyfin: true,
                      jellyfinId: ep.id,
                      mediaSourceId: ep.mediaSourceId,
                      itemType: 'Episode',
                      hasChildren: false,
                      indexNumber: ep.indexNumber,
                      parentIndexNumber: ep.parentIndexNumber,
                    })
                  }} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No episodes available</p>
            )}
          </div>
        )}

        {/* Cast */}
        {item.people?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Cast
            </h2>
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {item.people.slice(0, 20).map((person: any) => (
                  <div key={person.id} className="shrink-0 w-20 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-muted mb-1.5">
                      {person.thumbnail ? (
                        <img src={person.thumbnail} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                          <Users className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium line-clamp-1">{person.name}</p>
                    {person.role && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{person.role}</p>
                    )}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
    )
  }

  // ---- Music Album View ----
  if (item.type === 'MusicAlbum') {
    const tracks = item.podcastEpisodes || []

    return (
      <div className="space-y-6 mt-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Album Art */}
          <div className="shrink-0 w-full md:w-56">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted shadow-xl">
              {thumbnail ? (
                <img src={thumbnail} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-purple-950/50">
                  <Disc3 className="h-16 w-16 text-purple-500/30" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Album</p>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{item.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-muted-foreground">
                {item.productionYear && <span>{item.productionYear}</span>}
                {item.genres?.length > 0 && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.genres.join(', ')}</span>
                  </>
                )}
                {tracks.length > 0 && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{tracks.length} track{tracks.length > 1 ? 's' : ''}</span>
                  </>
                )}
                {item.cumulativeRuntime && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.cumulativeRuntime}</span>
                  </>
                )}
              </div>
            </div>

            {item.studios?.length > 0 && (
              <p className="text-sm text-muted-foreground">{item.studios.join(', ')}</p>
            )}

            {item.overview && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {item.overview}
              </p>
            )}

            <Button size="lg" className="gap-2" onClick={onPlay}>
              <Play className="h-5 w-5" />
              Play All
            </Button>
          </div>
        </div>

        {/* Track List */}
        {tracks.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-lg font-semibold mb-3">Tracklist</h2>
            {tracks.map((track: any, idx: number) => (
              <TrackRow
                key={track.id}
                track={track}
                index={track.indexNumber || idx + 1}
                onPlay={() => onPlayTrack({
                  id: `jf-${track.id}`,
                  title: track.name,
                  description: track.overview || '',
                  type: 'MUSIC',
                  genre: '',
                  thumbnail: track.thumbnail || thumbnail,
                  videoUrl: '',
                  duration: track.duration,
                  releaseYear: track.productionYear || 0,
                  artist: track.artists?.join(', ') || '',
                  views: 0,
                  channel: '',
                  isJellyfin: true,
                  jellyfinId: track.id,
                  mediaSourceId: track.mediaSourceId,
                  itemType: 'Audio',
                  hasChildren: false,
                  indexNumber: track.indexNumber || idx + 1,
                })}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- BoxSet (Collection) View ----
  if (item.type === 'BoxSet') {
    const children = item.children || []

    return (
      <div className="space-y-6 mt-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="shrink-0 w-full md:w-56">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted">
              {thumbnail ? (
                <img src={thumbnail} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/30 to-orange-950/50">
                  <Layers className="h-16 w-16 text-orange-500/30" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Collection</p>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{item.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-muted-foreground">
                {children.length > 0 && (
                  <span>{children.length} item{children.length > 1 ? 's' : ''}</span>
                )}
                {item.cumulativeRuntime && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.cumulativeRuntime}</span>
                  </>
                )}
              </div>
            </div>

            {item.overview && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.overview}
              </p>
            )}
          </div>
        </div>

        {/* Collection items */}
        {children.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Items in Collection</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {children.map((child: any) => {
                const childThumbnail = child.ImageTags?.Primary
                  ? `/api/jellyfin/image/${child.Id}?tag=${child.ImageTags.Primary}`
                  : ''
                const childItem = {
                  id: `jf-${child.Id}`,
                  title: child.Name || 'Untitled',
                  description: child.Overview || '',
                  type: child.Type === 'Movie' ? 'MOVIE' : 'TV_SHOW',
                  genre: (child.Genres || []).join(', '),
                  thumbnail: childThumbnail,
                  videoUrl: '',
                  duration: child.runtime || '',
                  releaseYear: child.ProductionYear || 0,
                  artist: '',
                  views: 0,
                  channel: child.OfficialRating || '',
                  isJellyfin: true,
                  jellyfinId: child.Id,
                  mediaSourceId: '',
                  itemType: child.Type,
                  hasChildren: false,
                  communityRating: child.CommunityRating,
                }
                return (
                  <JellyfinCard
                    key={child.Id}
                    item={childItem}
                    onNavigate={() => {
                      // Play the item directly from collection
                      onPlayTrack(childItem)
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- Generic Detail View (Movie, etc.) ----
  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Poster */}
        <div className="shrink-0 w-full md:w-56">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-xl">
            {thumbnail ? (
              <img src={thumbnail} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/30 to-red-950/50">
                <Film className="h-16 w-16 text-red-500/30" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">{item.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-muted-foreground">
              {item.productionYear && <span>{item.productionYear}</span>}
              {item.runtime && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{item.runtime}</span>
                </>
              )}
              {item.communityRating && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    {item.communityRating.toFixed(1)}
                  </span>
                </>
              )}
              {item.officialRating && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <Badge variant="outline" className="text-xs">{item.officialRating}</Badge>
                </>
              )}
            </div>
          </div>

          {/* Genres */}
          {item.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.genres.map((genre: string) => (
                <Badge key={genre} variant="secondary" className="text-xs">{genre}</Badge>
              ))}
            </div>
          )}

          {/* Overview */}
          {item.overview && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.overview}
            </p>
          )}

          {/* Media info */}
          {item.mediaInfo && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {item.mediaInfo.video?.resolution && (
                <Badge variant="outline">{item.mediaInfo.video.resolution}</Badge>
              )}
              {item.mediaInfo.video?.codec && (
                <span>{item.mediaInfo.video.codec.toUpperCase()}</span>
              )}
              {item.mediaInfo.audio?.codec && (
                <span>{item.mediaInfo.audio.codec.toUpperCase()} {item.mediaInfo.audio.channels}ch</span>
              )}
              {item.mediaInfo.fileSize && (
                <span>{item.mediaInfo.fileSize}</span>
              )}
            </div>
          )}

          {/* Play button */}
          <Button size="lg" className="gap-2" onClick={onPlay}>
            <Play className="h-5 w-5" />
            Play
          </Button>

          {/* External links */}
          {item.externalUrls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {item.externalUrls.map((url: { name: string; url: string }) => (
                <Button key={url.name} variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a href={url.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    {url.name}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cast */}
      {item.people?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Cast
          </h2>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {item.people.slice(0, 20).map((person: any) => (
                <div key={person.id} className="shrink-0 w-20 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-muted mb-1.5">
                    {person.thumbnail ? (
                      <img src={person.thumbnail} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                        <Users className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium line-clamp-1">{person.name}</p>
                  {person.role && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{person.role}</p>
                  )}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Crew */}
      {item.crew?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Crew</h2>
          <div className="flex flex-wrap gap-3">
            {item.crew.slice(0, 10).map((person: any) => (
              <div key={person.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                  {person.thumbnail ? (
                    <img src={person.thumbnail} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium">{person.name}</p>
                  <p className="text-[10px] text-muted-foreground">{person.type}{person.role ? ` - ${person.role}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EpisodeRow — Single episode row in series detail
// ---------------------------------------------------------------------------

interface EpisodeRowProps {
  episode: any
  onPlay: () => void
}

function EpisodeRow({ episode, onPlay }: EpisodeRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors duration-150 group">
      {/* Episode number */}
      <div className="shrink-0 w-8 text-center">
        <span className="text-sm text-muted-foreground font-medium">{episode.indexNumber || '-'}</span>
      </div>

      {/* Thumbnail */}
      <div className="relative w-28 sm:w-40 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
        {episode.thumbnail ? (
          <img src={episode.thumbnail} alt={episode.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Tv className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="h-4 w-4 text-white ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {episode.name}
        </h3>
        {episode.overview && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{episode.overview}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          {episode.duration && <span>{episode.duration}</span>}
          {episode.communityRating && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              {episode.communityRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Play button */}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onPlay()
        }}
      >
        <Play className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TrackRow — Single track row in album detail
// ---------------------------------------------------------------------------

interface TrackRowProps {
  track: any
  index: number
  onPlay: () => void
}

function TrackRow({ track, index, onPlay }: TrackRowProps) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors duration-150 group cursor-pointer"
      onClick={onPlay}
    >
      {/* Track number */}
      <div className="shrink-0 w-8 text-center relative">
        <span className="text-sm text-muted-foreground group-hover:hidden">{index}</span>
        <Play className="h-4 w-4 mx-auto hidden group-hover:block" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {track.name}
        </h3>
        {track.artists?.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1">{track.artists.join(', ')}</p>
        )}
      </div>

      {/* Duration */}
      {track.duration && (
        <span className="text-xs text-muted-foreground shrink-0">{track.duration}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContinueWatchingSection — Resume items
// ---------------------------------------------------------------------------

interface ContinueWatchingSectionProps {
  onNavigate: (item: any) => void
}

function ContinueWatchingSection({ onNavigate }: ContinueWatchingSectionProps) {
  const [resumeItems, setResumeItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResume = async () => {
      setLoading(true)
      try {
        const libsRes = await fetch('/api/jellyfin/libraries')
        if (!libsRes.ok) {
          setLoading(false)
          return
        }
        const libsData = await libsRes.json()
        const libraries = libsData.items || []

        const allResume: any[] = []
        for (const lib of libraries.slice(0, 4)) {
          try {
            const res = await fetch(`/api/jellyfin/items?parentId=${lib.id}&collectionType=${lib.collectionType || ''}`)
            if (res.ok) {
              const data = await res.json()
              const items = (data.items || []).filter((i: any) => i.duration && !i.hasChildren)
              allResume.push(...items.slice(0, 3))
            }
          } catch {
            // Non-critical
          }
        }
        setResumeItems(allResume.slice(0, 12))
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchResume()
  }, [])

  if (!loading && resumeItems.length === 0) return null

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-emerald-400" />
        Continue Watching
      </h2>
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[160px] sm:w-[200px] space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {resumeItems.map((item) => (
              <div
                key={item.id}
                className="shrink-0 w-[160px] sm:w-[200px] group cursor-pointer"
                onClick={() => onNavigate(item)}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                      <Play className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full w-2/3 bg-emerald-500 rounded-r-full" />
                  </div>
                  {/* Hover play */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-10 h-10 bg-emerald-500/90 rounded-full flex items-center justify-center">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="font-medium text-sm mt-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {item.releaseYear > 0 ? `${item.releaseYear}` : ''}{item.artist ? ` - ${item.artist}` : ''}
                </p>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </section>
  )
}
