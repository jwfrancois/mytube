'use client'

import { useAppStore } from '@/store/useAppStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Server, FolderOpen } from 'lucide-react'
import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

function cnHelper(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function JellyfinBrowser() {
  const {
    jellyfinItems,
    setJellyfinItems,
    jellyfinLoading,
    setJellyfinLoading,
    jellyfinBreadcrumbs,
    setJellyfinBreadcrumbs,
  } = useAppStore()

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

  const fetchItems = useCallback(async (parentId: string) => {
    setJellyfinLoading(true)
    try {
      const res = await fetch(`/api/jellyfin/items?parentId=${parentId}`)
      const data = await res.json()
      setJellyfinItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch Jellyfin items:', err)
    } finally {
      setJellyfinLoading(false)
    }
  }, [setJellyfinItems, setJellyfinLoading])

  useEffect(() => {
    if (jellyfinBreadcrumbs.length === 0) {
      fetchLibraries()
    }
  }, [jellyfinBreadcrumbs.length, fetchLibraries])

  const handleNavigate = (item: any) => {
    if (item.hasChildren) {
      setJellyfinBreadcrumbs([...jellyfinBreadcrumbs, { id: item.id, title: item.title }])
      fetchItems(item.id)
    } else {
      // It's playable content — set it as current media with streaming URL
      useAppStore.setState({
        currentMedia: {
          ...item,
          videoUrl: `/api/jellyfin/stream/${item.jellyfinId || item.id}`,
        },
        isPlaying: true,
      })
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = jellyfinBreadcrumbs.slice(0, index + 1)
    setJellyfinBreadcrumbs(newBreadcrumbs)
    const target = newBreadcrumbs[index]
    fetchItems(target.id)
  }

  const handleBackToRoot = () => {
    setJellyfinBreadcrumbs([])
    fetchLibraries()
  }

  if (jellyfinLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-8 w-40" />
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Server className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Jellyfin NAS</h1>
        <Badge variant="outline" className="text-xs gap-1 text-emerald-500 border-emerald-500/30">
          Connected
        </Badge>
      </div>

      {/* Breadcrumbs */}
      {jellyfinBreadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mb-4 text-sm flex-wrap">
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
                  "h-7 px-2",
                  index === jellyfinBreadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
                onClick={() => handleBreadcrumbClick(index)}
              >
                {crumb.title}
              </Button>
            </div>
          ))}
        </div>
      )}

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

interface JellyfinCardProps {
  item: any
  onNavigate: (item: any) => void
}

const typeColors: Record<string, string> = {
  MOVIE: 'bg-red-500/10 text-red-500 border-red-500/20',
  TV_SHOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  MUSIC: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
}

const typeIcons: Record<string, string> = {
  MOVIE: '🎬',
  TV_SHOW: '📺',
  MUSIC: '🎵',
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
}

function JellyfinCard({ item, onNavigate }: JellyfinCardProps) {
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
              <span className="text-4xl">{typeIcons[item.type] || '🎬'}</span>
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
            {item.hasChildren ? (itemTypeLabels[item.itemType] || item.itemType) : (itemTypeLabels[item.itemType] || item.type)}
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
                <span>•</span>
                <span>⭐ {item.communityRating.toFixed(1)}</span>
              </>
            )}
            {item.indexNumber && (
              <>
                <span>•</span>
                <span>E{item.indexNumber}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
