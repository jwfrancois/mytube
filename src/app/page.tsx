'use client'

import { useEffect, useCallback, useMemo } from 'react'
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
import { useWatchHistory } from '@/hooks/useWatchHistory'
import { cn } from '@/lib/utils'
import { History, TrendingUp, Bookmark, SlidersHorizontal } from 'lucide-react'

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
    mediaItems,
    setMediaItems,
    setIsLoading,
    setSearchResults,
    setIsSearching,
    jellyfinConnected,
    setJellyfinConnected,
    setJellyfinServer,
    setCurrentMedia,
  } = useAppStore()

  const {
    watchHistory,
    watchLater,
    addToHistory,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
  } = useWatchHistory()

  // Check if the current media is audio type (for the persistent bar)
  const isAudioPlaying = currentMedia ? isAudioType(currentMedia.type) : false

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'ALL') params.set('type', activeCategory)
      const res = await fetch(`/api/media?${params}`)
      const data = await res.json()
      setMediaItems(data.media || [])
    } catch (err) {
      console.error('Failed to fetch media:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeCategory, setMediaItems, setIsLoading])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  // Check Jellyfin connection on mount
  useEffect(() => {
    const checkJellyfin = async () => {
      try {
        const res = await fetch('/api/jellyfin/status')
        const data = await res.json()
        setJellyfinConnected(data.connected)
        if (data.server) setJellyfinServer(data.server)
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

  // Build sections for the home page when viewing ALL category
  const sections = useMemo<MediaSection[]>(() => {
    if (activeCategory !== 'ALL') return []

    const result: MediaSection[] = []

    // Continue Watching section — from watch history
    if (watchHistory.length > 0) {
      result.push({
        id: 'continue-watching',
        title: 'Continue Watching',
        items: watchHistory.slice(0, 20).map((h) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          type: h.type,
          genre: h.genre,
          thumbnail: h.thumbnail,
          videoUrl: h.videoUrl,
          duration: h.duration,
          releaseYear: h.releaseYear,
          artist: h.artist,
          views: h.views,
          channel: h.channel,
          isJellyfin: h.isJellyfin,
          jellyfinId: h.jellyfinId,
          itemType: h.itemType,
          communityRating: h.communityRating,
        })),
        icon: <History className="h-5 w-5 text-emerald-500" />,
      })
    }

    // Popular section — sorted by views/community rating
    if (mediaItems.length > 0) {
      const popularItems = [...mediaItems].sort((a, b) => {
        // Prefer community rating for Jellyfin items, views for local items
        const scoreA = a.communityRating ? a.communityRating * 100 : a.views || 0
        const scoreB = b.communityRating ? b.communityRating * 100 : b.views || 0
        return scoreB - scoreA
      }).slice(0, 20)

      if (popularItems.length > 0) {
        result.push({
          id: 'popular',
          title: 'Popular',
          items: popularItems,
          icon: <TrendingUp className="h-5 w-5 text-red-500" />,
        })
      }
    }

    // Watch Later section
    if (watchLater.length > 0) {
      result.push({
        id: 'watch-later',
        title: 'Watch Later',
        items: watchLater.map((w) => ({
          id: w.id,
          title: w.title,
          description: w.description,
          type: w.type,
          genre: w.genre,
          thumbnail: w.thumbnail,
          videoUrl: w.videoUrl,
          duration: w.duration,
          releaseYear: w.releaseYear,
          artist: w.artist,
          views: w.views,
          channel: w.channel,
          isJellyfin: w.isJellyfin,
          jellyfinId: w.jellyfinId,
          itemType: w.itemType,
          communityRating: w.communityRating,
        })),
        icon: <Bookmark className="h-5 w-5 text-amber-500" />,
      })
    }

    // By Genre sections
    if (mediaItems.length > 0) {
      const genreGroups: Record<string, any[]> = {}
      mediaItems.forEach((item) => {
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

    // For ALL category, use section-based layout
    if (activeCategory === 'ALL' && sections.length > 0) {
      return (
        <MediaGrid
          items={mediaItems}
          onRefresh={fetchMedia}
          sections={sections}
          onWatchLater={handleWatchLater}
          onRemoveWatchLater={handleRemoveWatchLater}
          isInWatchLater={handleIsInWatchLater}
          onPlay={handlePlay}
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
