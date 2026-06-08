'use client'

import { useAppStore } from '@/store/useAppStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
} from 'lucide-react'
import { useEffect, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cnHelper(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// Gradient backgrounds for each library collection type
const collectionGradients: Record<string, string> = {
  movies: 'from-red-600/80 via-red-700/60 to-red-900/80',
  tvshows: 'from-emerald-600/80 via-emerald-700/60 to-emerald-900/80',
  music: 'from-purple-600/80 via-purple-700/60 to-purple-900/80',
  podcasts: 'from-amber-600/80 via-amber-700/60 to-amber-900/80',
  books: 'from-teal-600/80 via-teal-700/60 to-teal-900/80',
  boxsets: 'from-orange-600/80 via-orange-700/60 to-orange-900/80',
  homevideos: 'from-rose-600/80 via-rose-700/60 to-rose-900/80',
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
          // Fetch server info after connecting
          await fetchServerStatus()
        } else if (data.notConfigured) {
          // Not configured — user needs to set up manually
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
    if (jellyfinConnected && jellyfinBreadcrumbs.length === 0) {
      fetchLibraries()
    }
  }, [jellyfinConnected, jellyfinBreadcrumbs.length, fetchLibraries])

  useEffect(() => {
    if (jellyfinConnected && jellyfinBreadcrumbs.length === 0) {
      fetchLatest()
    }
  }, [jellyfinConnected, jellyfinBreadcrumbs.length, fetchLatest])

  useEffect(() => {
    if (jellyfinConnected && !serverInfo) {
      fetchServerStatus()
    }
  }, [jellyfinConnected, serverInfo, fetchServerStatus])

  // --- Navigation ---

  const handleNavigate = (item: any) => {
    if (item.hasChildren) {
      const ct = item.collectionType || currentCollectionTypeRef()
      setJellyfinBreadcrumbs([...jellyfinBreadcrumbs, { id: item.id, title: item.title, collectionType: ct }])
      fetchItems(item.id, ct)
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
    const target = newBreadcrumbs[index]
    fetchItems(target.id, (target as any).collectionType || '')
  }

  const handleBackToRoot = () => {
    setJellyfinBreadcrumbs([])
    fetchLibraries()
  }

  const handleBackOneLevel = () => {
    if (jellyfinBreadcrumbs.length <= 1) {
      handleBackToRoot()
    } else {
      handleBreadcrumbClick(jellyfinBreadcrumbs.length - 2)
    }
  }

  // --- Determine if we are at root (library list) or drilled in ---
  const isAtRoot = jellyfinBreadcrumbs.length === 0

  // =====================================================================
  // DISCONNECTED STATE
  // =====================================================================

  if (!jellyfinConnected) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center text-center gap-6 pt-8 pb-8">
            {/* Server Icon */}
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
                <Server className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-destructive/20 border-2 border-background flex items-center justify-center">
                <WifiOff className="h-3 w-3 text-destructive" />
              </div>
            </div>

            {/* Title & Badge */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Jellyfin NAS</h2>
              <Badge variant="outline" className="text-xs gap-1.5 text-destructive border-destructive/30 bg-destructive/10">
                <WifiOff className="h-3 w-3" />
                Not Connected
              </Badge>
            </div>

            {/* Instructions */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open Settings to connect to your Jellyfin server and access your personal media library.
            </p>

            {/* Actions */}
            <div className="flex flex-col w-full gap-3">
              <Button
                className="w-full gap-2"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Open Settings
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={retryConnection}
                disabled={retrying}
              >
                <RefreshCw className={cnHelper('h-4 w-4', retrying && 'animate-spin')} />
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

  if (jellyfinLoading) {
    return (
      <div className="p-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-20" />
        </div>

        {isAtRoot ? (
          <>
            {/* Library cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
            {/* Latest row skeleton */}
            <Skeleton className="h-6 w-32 mb-4" />
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
        )}
      </div>
    )
  }

  // =====================================================================
  // CONNECTED & ROOT VIEW (Library overview — Jellyfin web home)
  // =====================================================================

  if (isAtRoot) {
    const libraryCards = jellyfinItems.filter(
      (item) => item.itemType === 'CollectionFolder' || item.itemType === 'UserView'
    )
    const nonLibraryItems = jellyfinItems.filter(
      (item) => item.itemType !== 'CollectionFolder' && item.itemType !== 'UserView'
    )

    return (
      <div className="p-6 space-y-8">
        {/* ---- Header Bar ---- */}
        <div className="flex items-center gap-3 flex-wrap">
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
          <Badge variant="outline" className="text-xs gap-1.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
            <Wifi className="h-3 w-3" />
            Connected
          </Badge>
        </div>

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

        {/* ---- Continue Watching / Resume Section ---- */}
        <ContinueWatchingSection onNavigate={handleNavigate} />

        {/* ---- Latest Added ---- */}
        {(latestItems.length > 0 || latestLoading) && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Recently Added
            </h2>
            {latestLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[200px] space-y-2">
                    <Skeleton className="aspect-video rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {latestItems.map((item) => (
                  <div
                    key={item.id}
                    className="shrink-0 w-[200px] group cursor-pointer"
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 bg-primary/90 rounded-full flex items-center justify-center">
                            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
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
            )}
          </section>
        )}

        {/* ---- Non-library top-level items (if any) ---- */}
        {nonLibraryItems.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Browse</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {nonLibraryItems.map((item) => (
                <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
              ))}
            </div>
          </section>
        )}

        {/* ---- Empty state ---- */}
        {libraryCards.length === 0 && nonLibraryItems.length === 0 && !jellyfinLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No libraries found</p>
            <p className="text-sm mt-1">Your Jellyfin server may not have any libraries configured</p>
          </div>
        )}
      </div>
    )
  }

  // =====================================================================
  // DRILLED-IN VIEW (Inside a library/folder)
  // =====================================================================

  return (
    <div className="p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleBackOneLevel}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-xl font-bold truncate">
          {jellyfinBreadcrumbs[jellyfinBreadcrumbs.length - 1]?.title || 'Library'}
        </h1>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 mb-6 text-sm flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={handleBackToRoot}
        >
          Libraries
        </Button>
        {jellyfinBreadcrumbs.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className={cnHelper(
                'h-7 px-2',
                index === jellyfinBreadcrumbs.length - 1
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground'
              )}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {crumb.title}
            </Button>
          </div>
        ))}
      </div>

      {/* Content */}
      {jellyfinItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No content found</p>
          <p className="text-sm mt-1">This library may be empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {jellyfinItems.map((item) => (
            <JellyfinCard key={item.id} item={item} onNavigate={handleNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LibraryCard — Large Netflix-style tile for top-level libraries
// ---------------------------------------------------------------------------

interface LibraryCardProps {
  item: any
  onNavigate: (item: any) => void
}

function LibraryCard({ item, onNavigate }: LibraryCardProps) {
  const collectionType = item.collectionType || ''
  const gradient = collectionGradients[collectionType] || 'from-slate-600/80 via-slate-700/60 to-slate-900/80'
  const IconComponent = collectionIcons[collectionType] || FolderOpen
  const accentColor = collectionAccentColors[collectionType] || 'text-slate-400'

  return (
    <Card
      className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden bg-transparent hover:scale-[1.02]"
      onClick={() => onNavigate(item)}
    >
      <div
        className={cn(
          'relative h-40 rounded-2xl bg-gradient-to-br p-5 flex flex-col justify-between overflow-hidden',
          gradient
        )}
      >
        {/* Decorative circle */}
        <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -right-2 -top-2 h-20 w-20 rounded-full bg-white/5" />

        {/* Top row: icon + item count */}
        <div className="flex items-start justify-between relative z-10">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <IconComponent className={cnHelper('h-6 w-6', accentColor)} />
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
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
// JellyfinCard — Compact card for drilled-in browsing
// ---------------------------------------------------------------------------

interface JellyfinCardProps {
  item: any
  onNavigate: (item: any) => void
}

function JellyfinCard({ item, onNavigate }: JellyfinCardProps) {
  // Pick an icon based on item type
  const ItemIcon = item.type === 'MOVIE' ? Film
    : item.type === 'TV_SHOW' ? Tv
    : item.type === 'MUSIC' ? Music
    : item.type === 'PODCAST' ? Mic
    : item.type === 'AUDIOBOOK' ? Headphones
    : item.type === 'COLLECTION' ? Layers
    : FolderOpen

  return (
    <div
      className="group cursor-pointer border-0 shadow-none hover:shadow-md transition-all duration-200 overflow-hidden bg-transparent"
      onClick={() => onNavigate(item)}
    >
      {/* Thumbnail */}
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
            {item.hasChildren ? (
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
            ) : (
              <ItemIcon className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
        )}

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {item.duration}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cnHelper("text-[10px] px-1.5 py-0 h-5 backdrop-blur-sm", typeColors[item.type] || 'bg-muted text-muted-foreground')}
          >
            {item.hasChildren ? (itemTypeLabels[item.itemType] || item.itemType) : (typeLabels[item.type] || itemTypeLabels[item.itemType] || item.type)}
          </Badge>
        </div>

        {/* Children indicator */}
        {item.hasChildren && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
                <ChevronRight className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Non-children play indicator */}
        {!item.hasChildren && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 bg-primary/90 rounded-full flex items-center justify-center">
                <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* Child count */}
        {item.childCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {item.childCount} items
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-3 mt-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {item.channel || item.artist || itemTypeLabels[item.itemType] || ''}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
            {item.communityRating && (
              <>
                <span>{item.releaseYear > 0 ? ' - ' : ''}</span>
                <span>{item.communityRating.toFixed(1)}/10</span>
              </>
            )}
            {item.indexNumber && (
              <>
                <span>{(item.releaseYear || item.communityRating) ? ' - ' : ''}</span>
                <span>E{item.indexNumber}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContinueWatchingSection — Fetches resume items from all libraries
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
        // Try fetching resume items from Jellyfin
        const libsRes = await fetch('/api/jellyfin/libraries')
        if (!libsRes.ok) {
          setLoading(false)
          return
        }
        const libsData = await libsRes.json()
        const libraries = libsData.items || []

        // Fetch items with resume data from each library
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
        Resume
      </h2>
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[200px] space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {resumeItems.map((item) => (
            <div
              key={item.id}
              className="shrink-0 w-[200px] group cursor-pointer"
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
                {/* Progress bar hint */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full w-2/3 bg-primary rounded-r-full" />
                </div>
                {/* Hover play */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 bg-primary/90 rounded-full flex items-center justify-center">
                      <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="font-medium text-sm mt-2 line-clamp-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {item.releaseYear > 0 ? `${item.releaseYear}` : ''}{item.artist ? ` - ${item.artist}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
