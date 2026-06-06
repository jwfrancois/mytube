'use client'

import { useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
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
import { History, TrendingUp, Bookmark, SlidersHorizontal, Film, Tv, Music, Mic, Headphones, FolderOpen, Layers } from 'lucide-react'

function isAudioType(type: string): boolean {
  return ['MUSIC', 'PODCAST', 'AUDIOBOOK'].includes(type)
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
    showKnowledgeGraph,
    setShowKnowledgeGraph,
  } = useAppStore()

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

  // Check Jellyfin connection on mount, auto-connect if not connected
  const autoConnectAttemptedRef = useRef(false)

  useEffect(() => {
    const checkJellyfin = async () => {
      try {
        const res = await fetch('/api/jellyfin/status')
        const data = await res.json()
        if (data.connected) {
          setJellyfinConnected(true)
          if (data.server) setJellyfinServer(data.server)
          return
        }

        // Not connected — attempt auto-connect once per session
        if (autoConnectAttemptedRef.current) return
        autoConnectAttemptedRef.current = true

        try {
          const connectRes = await fetch('/api/jellyfin/auto-connect', {
            method: 'POST',
          })

          if (connectRes.ok) {
            const connectData = await connectRes.json()
            if (connectData.success) {
              setJellyfinConnected(true)
              if (connectData.server) setJellyfinServer(connectData.server)
            }
          }
        } catch (connectErr) {
          console.error('Auto-connect to Jellyfin failed:', connectErr)
        }
      } catch {
        setJellyfinConnected(false)
      }
    }
    checkJellyfin()
  }, [setJellyfinConnected, setJellyfinServer])

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

    // Group Jellyfin items by type for Home page
    const jellyfinMovies = mediaItems.filter(i => i.isJellyfin && i.type === 'MOVIE')
    const jellyfinTVShows = mediaItems.filter(i => i.isJellyfin && i.type === 'TV_SHOW')
    const jellyfinMusic = mediaItems.filter(i => i.isJellyfin && i.type === 'MUSIC')
    const jellyfinPodcasts = mediaItems.filter(i => i.isJellyfin && i.type === 'PODCAST')
    const jellyfinAudiobooks = mediaItems.filter(i => i.isJellyfin && i.type === 'AUDIOBOOK')
    const jellyfinCollections = mediaItems.filter(i => i.isJellyfin && i.type === 'COLLECTION')

    if (jellyfinMovies.length > 0) {
      result.push({
        id: 'jellyfin-movies',
        title: 'Movies',
        items: jellyfinMovies,
        icon: <Film className="h-5 w-5 text-red-400" />,
      })
    }

    if (jellyfinTVShows.length > 0) {
      result.push({
        id: 'jellyfin-tvshows',
        title: 'TV Shows',
        items: jellyfinTVShows,
        icon: <Tv className="h-5 w-5 text-emerald-400" />,
      })
    }

    if (jellyfinMusic.length > 0) {
      result.push({
        id: 'jellyfin-music',
        title: 'Music',
        items: jellyfinMusic,
        icon: <Music className="h-5 w-5 text-purple-400" />,
      })
    }

    if (jellyfinPodcasts.length > 0) {
      result.push({
        id: 'jellyfin-podcasts',
        title: 'Podcasts',
        items: jellyfinPodcasts,
        icon: <Mic className="h-5 w-5 text-amber-400" />,
      })
    }

    if (jellyfinAudiobooks.length > 0) {
      result.push({
        id: 'jellyfin-audiobooks',
        title: 'Audiobooks',
        items: jellyfinAudiobooks,
        icon: <Headphones className="h-5 w-5 text-teal-400" />,
      })
    }

    if (jellyfinCollections.length > 0) {
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
  }, [activeCategory, watchHistory, watchLater, mediaItems])

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
        <MediaGrid
          items={mediaItems}
          onRefresh={fetchMedia}
          sections={sections}
          onWatchLater={handleWatchLater}
          onRemoveWatchLater={handleRemoveWatchLater}
          isInWatchLater={handleIsInWatchLater}
          onPlay={handlePlay}
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
      )
    }

    // For other categories, use standard grid
    return (
      <MediaGrid
        items={mediaItems}
        onRefresh={fetchMedia}
        onWatchLater={handleWatchLater}
        onRemoveWatchLater={handleRemoveWatchLater}
        isInWatchLater={handleIsInWatchLater}
        onPlay={handlePlay}
      />
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
