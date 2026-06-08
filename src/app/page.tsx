'use client'

import { useEffect, useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAppStore, MediaType } from '@/store/useAppStore'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { MediaGrid, MediaSection } from '@/components/MediaGrid'
import { VideoPlayer } from '@/components/VideoPlayer'
import { AudioPlayerBar } from '@/components/AudioPlayerBar'
import { SearchResults } from '@/components/SearchResults'
import { AddMediaDialog } from '@/components/AddMediaDialog'
import { SettingsDialog } from '@/components/SettingsDialog'
import { JellyfinBrowser } from '@/components/JellyfinBrowser'
import { AIConcierge } from '@/components/AIConcierge'
import { AIRadioStations } from '@/components/AIRadioStations'
import { SemanticDiscovery } from '@/components/SemanticDiscovery'
import { SmartCollections } from '@/components/SmartCollections'
import { LivingHomeScreen } from '@/components/LivingHomeScreen'
import { MediaKnowledgeGraph } from '@/components/MediaKnowledgeGraph'

import { useWatchHistory } from '@/hooks/useWatchHistory'
import { cn } from '@/lib/utils'
import { isAudioType } from '@/lib/media-utils'
import { History, TrendingUp, Bookmark, SlidersHorizontal, Film, Tv, Music, Mic, Headphones, FolderOpen, Layers, Server, AlertCircle, X } from 'lucide-react'

const categoryTitle: Record<string, string> = {
  MOVIE: 'Movies',
  TV_SHOW: 'TV Shows',
  MUSIC: 'Music',
  PODCAST: 'Podcasts',
  AUDIOBOOK: 'Audiobooks',
  COLLECTION: 'Collections',
}

export default function Home() {
  const {
    sidebarOpen,
    activeCategory,
    searchQuery,
    isSearching,
    currentMedia,
    audioTrack,
    mediaItems,
    setMediaItems,
    setIsLoading,
    setSearchResults,
    setIsSearching,
    jellyfinConnected,
    setJellyfinConnected,
    setJellyfinServer,
    setCurrentMedia,
    setActiveCategory,
    showKnowledgeGraph,
    setShowKnowledgeGraph,

  } = useAppStore()

  // Track Jellyfin connection failure state
  const [jellyfinConnectionFailed, setJellyfinConnectionFailed] = useState(false)
  const [showConnectionBanner, setShowConnectionBanner] = useState(true)
  const [jellyfinEnvConfigured, setJellyfinEnvConfigured] = useState(false)

  const {
    watchHistory,
    watchLater,
    addToHistory,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
  } = useWatchHistory()

  // Track mount state to prevent hydration mismatch
  // (watchHistory/watchLater read from localStorage on client but not on server)
  // Using useSyncExternalStore is the React-recommended way to handle server/client differences
  const mounted = useSyncExternalStore(
    () => () => {}, // subscribe (no-op, value never changes)
    () => true,     // getSnapshot (client: always true after hydration)
    () => false     // getServerSnapshot (server: always false)
  )

  // Track whether we've loaded Jellyfin items for the home page
  const jellyfinHomeLoadedRef = useRef(false)

  // Check if the current media is audio type (for the persistent bar)
  const isAudioPlaying = !!(audioTrack || (currentMedia && isAudioType(currentMedia.type)))

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'ALL') params.set('type', activeCategory)
      // Include Jellyfin items when connected
      if (jellyfinConnected) {
        params.set('includeJellyfin', 'true')
      }
      const res = await fetch(`/api/media?${params}`)
      const data = await res.json()
      setMediaItems(data.media || [])
    } catch (err) {
      console.error('Failed to fetch media:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeCategory, jellyfinConnected, setMediaItems, setIsLoading])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  // Auto-connect to Jellyfin with retry mechanism
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoConnectMountedRef = useRef(true)

  const RETRY_DELAYS = [0, 5000, 15000] // immediate, 5s, 15s
  const MAX_RETRIES = 3

  useEffect(() => {
    autoConnectMountedRef.current = true

    const attemptConnect = async (attempt: number): Promise<void> => {
      if (!autoConnectMountedRef.current) return

      try {
        // First check if already connected
        const statusRes = await fetch('/api/jellyfin/status')
        const statusData = await statusRes.json()

        if (statusData.connected) {
          setJellyfinConnected(true)
          setJellyfinConnectionFailed(false)
          if (statusData.server) setJellyfinServer(statusData.server)
          return
        }

        // Not connected — try auto-connect
        try {
          const connectRes = await fetch('/api/jellyfin/auto-connect', {
            method: 'POST',
          })

          if (connectRes.ok) {
            const connectData = await connectRes.json()
            if (connectData.success) {
              if (!autoConnectMountedRef.current) return
              setJellyfinConnected(true)
              setJellyfinConnectionFailed(false)
              if (connectData.server) setJellyfinServer(connectData.server)
              return
            }
            // notConfigured means env vars are not set — no point retrying
            if (connectData.notConfigured) {
              setJellyfinEnvConfigured(false)
              return
            }
            setJellyfinEnvConfigured(true)
          } else {
            setJellyfinEnvConfigured(true)
          }
        } catch (connectErr) {
          console.error(`Auto-connect attempt ${attempt + 1} failed:`, connectErr)
          setJellyfinEnvConfigured(true)
        }

        // Connection attempt failed — schedule retry if under max
        if (attempt + 1 < MAX_RETRIES && autoConnectMountedRef.current) {
          const nextDelay = RETRY_DELAYS[attempt + 1] || 15000
          retryTimerRef.current = setTimeout(() => {
            retryCountRef.current = attempt + 1
            attemptConnect(attempt + 1)
          }, nextDelay)
        } else if (autoConnectMountedRef.current) {
          // All retries exhausted
          setJellyfinConnectionFailed(true)
          setJellyfinConnected(false)
        }
      } catch {
        setJellyfinConnected(false)
        setJellyfinEnvConfigured(true)

        if (attempt + 1 < MAX_RETRIES && autoConnectMountedRef.current) {
          const nextDelay = RETRY_DELAYS[attempt + 1] || 15000
          retryTimerRef.current = setTimeout(() => {
            retryCountRef.current = attempt + 1
            attemptConnect(attempt + 1)
          }, nextDelay)
        } else if (autoConnectMountedRef.current) {
          setJellyfinConnectionFailed(true)
        }
      }
    }

    attemptConnect(0)

    return () => {
      autoConnectMountedRef.current = false
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [setJellyfinConnected, setJellyfinServer])

  // Re-fetch media when Jellyfin connection state changes to true
  useEffect(() => {
    if (jellyfinConnected) {
      fetchMedia()
    }
  }, [jellyfinConnected, fetchMedia])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.media || [])
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, setSearchResults, setIsSearching])

  const handlePlay = useCallback((item: any) => {
    // If item has children (series, album, podcast show, etc.), open detail view
    if (item.isJellyfin && item.hasChildren) {
      setCurrentMedia(item)
      return
    }
    setCurrentMedia(item)
    addToHistory(item)
  }, [setCurrentMedia, addToHistory])

  const handleWatchLater = useCallback((item: any) => {
    addToWatchLater(item)
  }, [addToWatchLater])

  const handleRemoveWatchLater = useCallback((id: string) => {
    removeFromWatchLater(id)
  }, [removeFromWatchLater])

  const handleIsInWatchLater = useCallback((id: string) => {
    return isInWatchLater(id)
  }, [isInWatchLater])

  // Build sections for the home page
  const sections = useMemo<MediaSection[]>(() => {
    const result: MediaSection[] = []

    // Continue Watching section
    if (watchHistory.length > 0) {
      result.push({
        id: 'continue-watching',
        title: 'Continue Watching',
        items: watchHistory.slice(0, 20),
        icon: <History className="h-5 w-5 text-emerald-400" />,
      })
    }

    // Popular section — sorted by views/community rating
    if (mediaItems.length > 0) {
      const popularItems = [...mediaItems].sort((a, b) => {
        const scoreA = a.communityRating ? a.communityRating * 100 : a.views || 0
        const scoreB = b.communityRating ? b.communityRating * 100 : b.views || 0
        return scoreB - scoreA
      }).slice(0, 20)

      if (popularItems.length > 0) {
        result.push({
          id: 'popular',
          title: 'Trending Now',
          items: popularItems,
          icon: <TrendingUp className="h-5 w-5 text-mythic" />,
        })
      }
    }

    // Watch Later section
    if (watchLater.length > 0) {
      result.push({
        id: 'watch-later',
        title: 'My List',
        items: watchLater,
        icon: <Bookmark className="h-5 w-5 text-amber-400" />,
      })
    }

    // Jellyfin NAS section — always show when connected
    if (jellyfinConnected) {
      result.push({
        id: 'jellyfin-nas',
        title: 'Jellyfin NAS',
        items: [{
          id: 'jellyfin-browser-link',
          title: 'Browse Jellyfin NAS',
          description: 'Explore all media on your Jellyfin server',
          type: 'JELLYFIN',
          genre: '',
          thumbnail: '',
          videoUrl: '',
          duration: '',
          releaseYear: 0,
          artist: '',
          views: 0,
          channel: '',
          createdAt: '',
          isJellyfin: true,
          hasChildren: true,
        }],
        icon: <Server className="h-5 w-5 text-emerald-400" />,
      })
    }

    // Group Jellyfin items by type for Home page
    // Always show Jellyfin category sections when connected, even with 0 items
    const jellyfinMovies = mediaItems.filter(i => i.isJellyfin && i.type === 'MOVIE')
    const jellyfinTVShows = mediaItems.filter(i => i.isJellyfin && i.type === 'TV_SHOW')
    const jellyfinMusic = mediaItems.filter(i => i.isJellyfin && i.type === 'MUSIC')
    const jellyfinPodcasts = mediaItems.filter(i => i.isJellyfin && i.type === 'PODCAST')
    const jellyfinAudiobooks = mediaItems.filter(i => i.isJellyfin && i.type === 'AUDIOBOOK')
    const jellyfinCollections = mediaItems.filter(i => i.isJellyfin && i.type === 'COLLECTION')

    if (jellyfinConnected || jellyfinMovies.length > 0) {
      result.push({
        id: 'jellyfin-movies',
        title: 'Movies',
        items: jellyfinMovies,
        icon: <Film className="h-5 w-5 text-red-400" />,
      })
    }

    if (jellyfinConnected || jellyfinTVShows.length > 0) {
      result.push({
        id: 'jellyfin-tvshows',
        title: 'TV Shows',
        items: jellyfinTVShows,
        icon: <Tv className="h-5 w-5 text-emerald-400" />,
      })
    }

    if (jellyfinConnected || jellyfinMusic.length > 0) {
      result.push({
        id: 'jellyfin-music',
        title: 'Music',
        items: jellyfinMusic,
        icon: <Music className="h-5 w-5 text-purple-400" />,
      })
    }

    if (jellyfinConnected || jellyfinPodcasts.length > 0) {
      result.push({
        id: 'jellyfin-podcasts',
        title: 'Podcasts',
        items: jellyfinPodcasts,
        icon: <Mic className="h-5 w-5 text-amber-400" />,
      })
    }

    if (jellyfinConnected || jellyfinAudiobooks.length > 0) {
      result.push({
        id: 'jellyfin-audiobooks',
        title: 'Audiobooks',
        items: jellyfinAudiobooks,
        icon: <Headphones className="h-5 w-5 text-teal-400" />,
      })
    }

    if (jellyfinConnected || jellyfinCollections.length > 0) {
      result.push({
        id: 'jellyfin-collections',
        title: 'Collections',
        items: jellyfinCollections,
        icon: <Layers className="h-5 w-5 text-orange-400" />,
      })
    }

    // By Genre sections (local items only)
    const localItems = mediaItems.filter(i => !i.isJellyfin)
    if (localItems.length > 0) {
      const genreGroups: Record<string, any[]> = {}
      localItems.forEach((item) => {
        const genre = item.genre || 'Other'
        if (!genreGroups[genre]) genreGroups[genre] = []
        genreGroups[genre].push(item)
      })

      Object.entries(genreGroups).forEach(([genre, genreItems]) => {
        result.push({
          id: `genre-${genre.toLowerCase().replace(/\s+/g, '-')}`,
          title: genre,
          items: genreItems,
          icon: <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />,
        })
      })
    }

    return result
  }, [activeCategory, watchHistory, watchLater, mediaItems, jellyfinConnected])

  const renderContent = () => {
    if (currentMedia) return <VideoPlayer />
    if (isSearching || searchQuery) return <SearchResults onSearch={handleSearch} />
    if (activeCategory === 'JELLYFIN') return <JellyfinBrowser />

    // Knowledge Graph full-screen view
    if (showKnowledgeGraph) {
      return (
        <MediaKnowledgeGraph
          onPlay={handlePlay}
          onClose={() => setShowKnowledgeGraph(false)}
        />
      )
    }

    // During SSR/hydration, render a consistent loading state to prevent mismatch.
    // After mount, localStorage data (watchHistory/watchLater) is available,
    // so we can render the full sections-based UI.
    if (!mounted) {
      return (
        <div className="py-6">
          {/* Hero skeleton */}
          <div className="relative w-full h-[50vh] min-h-[360px] max-h-[600px] mb-8">
            <div className="w-full h-full bg-muted/20 animate-pulse rounded-none" />
          </div>
          {/* AI Concierge skeleton */}
          <div className="px-6 mb-8">
            <div className="h-48 w-full bg-muted/20 animate-pulse rounded-2xl" />
          </div>
          {/* Section skeletons */}
          {[1, 2, 3].map((s) => (
            <div key={s} className="mb-8 px-6">
              <div className="h-6 w-40 mb-4 bg-muted/20 animate-pulse rounded" />
              <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[220px] space-y-2">
                    <div className="aspect-video rounded-lg w-full bg-muted/20 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full shrink-0 bg-muted/20 animate-pulse" />
                      <div className="space-y-1 flex-1">
                        <div className="h-3.5 w-3/4 bg-muted/20 animate-pulse rounded" />
                        <div className="h-3 w-1/2 bg-muted/20 animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    // For ALL category, use section-based layout with AI components
    if (activeCategory === 'ALL' && sections.length > 0) {
      // Find the index after "Trending Now" section for AI Radio placement
      const trendingIndex = sections.findIndex(s => s.id === 'popular')
      const radioInsertIndex = trendingIndex >= 0 ? trendingIndex + 1 : 2

      return (
        <>
          {/* Connection failure banner */}
          {jellyfinConnectionFailed && jellyfinEnvConfigured && showConnectionBanner && (
            <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Could not connect to Jellyfin NAS. Media from your server is unavailable.</span>
              <button
                onClick={() => setShowConnectionBanner(false)}
                className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-amber-500/20 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <MediaGrid
            items={mediaItems}
            onRefresh={fetchMedia}
            sections={sections}
            onWatchLater={handleWatchLater}
            onRemoveWatchLater={handleRemoveWatchLater}
            isInWatchLater={handleIsInWatchLater}
            onPlay={(item) => {
              // Special handling for the Jellyfin NAS browser link card
              if (item.id === 'jellyfin-browser-link') {
                setActiveCategory('JELLYFIN')
                return
              }
              handlePlay(item)
            }}
            preBanner={<LivingHomeScreen mediaItems={mediaItems} onPlay={handlePlay} />}
            topSlot={<AIConcierge onPlay={handlePlay} />}
            middleSlot={(
              <>
                <AIRadioStations onPlay={handlePlay} />
                <SemanticDiscovery onPlay={handlePlay} />
                <SmartCollections onPlay={handlePlay} />
              </>
            )}
            middleSlotAfterSectionId={radioInsertIndex > 0 ? sections[radioInsertIndex - 1]?.id : undefined}
          />
        </>
      )
    }

    // For other categories, build category-specific sections grouped by genre
    const categoryFilteredItems = mediaItems.filter(i => i.type === activeCategory)

    const categorySections: MediaSection[] = []
    if (categoryFilteredItems.length > 0) {
      // Group by genre within the category
      const genreGroups: Record<string, any[]> = {}
      categoryFilteredItems.forEach((item) => {
        const genre = item.genre || 'Other'
        if (!genreGroups[genre]) genreGroups[genre] = []
        genreGroups[genre].push(item)
      })

      Object.entries(genreGroups).forEach(([genre, genreItems]) => {
        categorySections.push({
          id: `category-${activeCategory}-${genre.toLowerCase().replace(/\s+/g, '-')}`,
          title: genre,
          items: genreItems,
        })
      })

      // If no genre groups, add a single section with all items
      if (categorySections.length === 0) {
        categorySections.push({
          id: `category-${activeCategory}`,
          title: categoryTitle[activeCategory] || activeCategory,
          items: categoryFilteredItems,
        })
      }
    }

    return (
      <>
        {/* Connection failure banner — show even on fallback/empty pages */}
        {jellyfinConnectionFailed && jellyfinEnvConfigured && showConnectionBanner && activeCategory === 'ALL' && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Could not connect to Jellyfin NAS. Your Jellyfin server may need a restart.</span>
            <button
              onClick={() => setShowConnectionBanner(false)}
              className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-amber-500/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <MediaGrid
          items={mediaItems}
          onRefresh={fetchMedia}
          sections={categorySections.length > 0 ? categorySections : undefined}
          onWatchLater={handleWatchLater}
          onRemoveWatchLater={handleRemoveWatchLater}
          isInWatchLater={handleIsInWatchLater}
          onPlay={handlePlay}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onSearch={handleSearch} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className={cn(
          "flex-1 overflow-y-auto",
          isAudioPlaying && "pb-20"
        )}>
          {renderContent()}
        </main>
      </div>
      <AddMediaDialog onAdded={fetchMedia} />
      <SettingsDialog />
      {/* Persistent audio player bar */}
      <AudioPlayerBar />
    </div>
  )
}
