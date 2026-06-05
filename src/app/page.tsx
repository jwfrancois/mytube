'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore, MediaType } from '@/store/useAppStore'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { MediaGrid } from '@/components/MediaGrid'
import { VideoPlayer } from '@/components/VideoPlayer'
import { SearchResults } from '@/components/SearchResults'
import { AddMediaDialog } from '@/components/AddMediaDialog'
import { SettingsDialog } from '@/components/SettingsDialog'
import { JellyfinBrowser } from '@/components/JellyfinBrowser'

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
  } = useAppStore()

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

  const renderContent = () => {
    if (currentMedia) return <VideoPlayer />
    if (isSearching || searchQuery) return <SearchResults onSearch={handleSearch} />
    if (activeCategory === 'JELLYFIN') return <JellyfinBrowser />
    return <MediaGrid items={mediaItems} onRefresh={fetchMedia} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header onSearch={handleSearch} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
      <AddMediaDialog onAdded={fetchMedia} />
      <SettingsDialog />
    </div>
  )
}
