'use client'

import { useState, useCallback } from 'react'

const WATCH_HISTORY_KEY = 'mytube_watch_history'
const WATCH_LATER_KEY = 'mytube_watch_later'
const MAX_HISTORY_ITEMS = 50

interface WatchHistoryItem {
  id: string
  title: string
  description: string
  type: string
  genre: string
  thumbnail: string
  videoUrl: string
  duration: string
  releaseYear: number
  artist: string
  views: number
  channel: string
  isJellyfin?: boolean
  jellyfinId?: string
  itemType?: string
  communityRating?: number
  watchedAt: string
}

interface WatchLaterItem {
  id: string
  title: string
  description: string
  type: string
  genre: string
  thumbnail: string
  videoUrl: string
  duration: string
  releaseYear: number
  artist: string
  views: number
  channel: string
  isJellyfin?: boolean
  jellyfinId?: string
  itemType?: string
  communityRating?: number
  addedAt: string
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable
  }
}

export function useWatchHistory() {
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>(() =>
    loadFromStorage<WatchHistoryItem[]>(WATCH_HISTORY_KEY, [])
  )
  const [watchLater, setWatchLater] = useState<WatchLaterItem[]>(() =>
    loadFromStorage<WatchLaterItem[]>(WATCH_LATER_KEY, [])
  )

  const addToHistory = useCallback((item: Omit<WatchHistoryItem, 'watchedAt'>) => {
    setWatchHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((h) => h.id !== item.id)
      const newItem: WatchHistoryItem = { ...item, watchedAt: new Date().toISOString() }
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      saveToStorage(WATCH_HISTORY_KEY, updated)
      return updated
    })
  }, [])

  const addToWatchLater = useCallback((item: Omit<WatchLaterItem, 'addedAt'>) => {
    setWatchLater((prev) => {
      // Don't add duplicate
      if (prev.some((w) => w.id === item.id)) return prev
      const newItem: WatchLaterItem = { ...item, addedAt: new Date().toISOString() }
      const updated = [newItem, ...prev]
      saveToStorage(WATCH_LATER_KEY, updated)
      return updated
    })
  }, [])

  const removeFromWatchLater = useCallback((id: string) => {
    setWatchLater((prev) => {
      const updated = prev.filter((w) => w.id !== id)
      saveToStorage(WATCH_LATER_KEY, updated)
      return updated
    })
  }, [])

  const isInWatchLater = useCallback(
    (id: string) => {
      return watchLater.some((w) => w.id === id)
    },
    [watchLater]
  )

  return {
    watchHistory,
    watchLater,
    addToHistory,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
  }
}
