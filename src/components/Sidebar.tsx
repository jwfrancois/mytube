'use client'

import { useAppStore, MediaType } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
  Home,
  Film,
  Tv,
  Music,
  Mic,
  Headphones,
  Settings,
  Server,
  FolderOpen,
  Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState, useRef } from 'react'

interface SidebarItem {
  icon: React.ElementType
  label: string
  category?: MediaType
  action?: () => void
  active?: boolean
}

interface JellyfinLibrary {
  id: string
  name: string
  collectionType: string
}

// Map Jellyfin collection types to our icon components
const collectionTypeIcons: Record<string, React.ElementType> = {
  movies: Film,
  tvshows: Tv,
  music: Music,
  podcasts: Mic,
  books: Headphones,
  homevideos: Film,
  boxsets: FolderOpen,
}

const collectionTypeToMediaType: Record<string, MediaType> = {
  movies: 'MOVIE',
  tvshows: 'TV_SHOW',
  music: 'MUSIC',
  podcasts: 'PODCAST',
  books: 'AUDIOBOOK',
  homevideos: 'MOVIE',
  boxsets: 'COLLECTION',
}

export function Sidebar() {
  const {
    sidebarOpen,
    activeCategory,
    setActiveCategory,
    setCurrentMedia,
    setSearchQuery,
    setIsSearching,
    jellyfinConnected,
    setSettingsOpen,
    setShowKnowledgeGraph,
    showKnowledgeGraph,
  } = useAppStore()

  const [jellyfinLibraries, setJellyfinLibraries] = useState<JellyfinLibrary[]>([])

  const librariesFetchedRef = useRef(false)

  // Fetch Jellyfin libraries when connected
  useEffect(() => {
    if (!jellyfinConnected || librariesFetchedRef.current) return
    librariesFetchedRef.current = true

    const loadLibraries = async () => {
      try {
        const res = await fetch('/api/jellyfin/libraries')
        if (res.ok) {
          const data = await res.json()
          const libs = (data.items || []).map((item: any) => ({
            id: item.id,
            name: item.title,
            collectionType: item.collectionType || '',
          })).filter((lib: JellyfinLibrary) => lib.collectionType && collectionTypeToMediaType[lib.collectionType])
          setJellyfinLibraries(libs)
        }
      } catch (err) {
        console.error('Failed to fetch Jellyfin libraries for sidebar:', err)
      }
    }
    loadLibraries()
  }, [jellyfinConnected])

  const mainItems: SidebarItem[] = [
    { icon: Home, label: 'Home', category: 'ALL', active: activeCategory === 'ALL' && !showKnowledgeGraph },
    { icon: Network, label: 'Knowledge Graph', active: showKnowledgeGraph, action: () => {
      setShowKnowledgeGraph(!showKnowledgeGraph)
    }},
  ]

  const categoryItems: SidebarItem[] = [
    { icon: Film, label: 'Movies', category: 'MOVIE', active: activeCategory === 'MOVIE' },
    { icon: Tv, label: 'TV Shows', category: 'TV_SHOW', active: activeCategory === 'TV_SHOW' },
    { icon: Music, label: 'Music', category: 'MUSIC', active: activeCategory === 'MUSIC' },
    { icon: Mic, label: 'Podcasts', category: 'PODCAST', active: activeCategory === 'PODCAST' },
    { icon: Headphones, label: 'Audiobooks', category: 'AUDIOBOOK', active: activeCategory === 'AUDIOBOOK' },
    { icon: FolderOpen, label: 'Collections', category: 'COLLECTION', active: activeCategory === 'COLLECTION' },
  ]

  const jellyfinItems: SidebarItem[] = [
    { icon: Server, label: 'Jellyfin NAS', category: 'JELLYFIN', active: activeCategory === 'JELLYFIN' },
  ]

  const handleItemClick = (item: SidebarItem) => {
    // Handle items with custom actions (e.g., Knowledge Graph)
    if (item.action) {
      item.action()
      return
    }

    // If Knowledge Graph, toggle the graph view
    if (item.label === 'Knowledge Graph') {
      setShowKnowledgeGraph(!showKnowledgeGraph)
      return
    }

    if (item.category) {
      setCurrentMedia(null)
      setSearchQuery('')
      setIsSearching(false)
      setActiveCategory(item.category)

      // Close Knowledge Graph when navigating to any category
      if (showKnowledgeGraph) {
        setShowKnowledgeGraph(false)
      }
    }
  }

  const handleSettingsClick = () => {
    setSettingsOpen(true)
  }

  if (!sidebarOpen) {
    return (
      <aside className="w-[72px] shrink-0 border-r border-border/50 bg-sidebar/80 backdrop-blur-sm flex flex-col items-center py-2 gap-1">
        {mainItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={cn(
              "flex flex-col items-center gap-1 h-auto py-3 px-2 w-full rounded-lg transition-colors",
              item.active && "text-mythic"
            )}
            onClick={() => handleItemClick(item)}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] leading-tight">{item.label}</span>
          </Button>
        ))}
        <Separator className="my-1 bg-white/5" />
        {categoryItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={cn(
              "flex flex-col items-center gap-1 h-auto py-3 px-2 w-full rounded-lg transition-colors",
              item.active && "text-mythic bg-mythic/10"
            )}
            onClick={() => handleItemClick(item)}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] leading-tight">{item.label}</span>
          </Button>
        ))}
        {jellyfinConnected && (
          <>
            <Separator className="my-1 bg-white/5" />
            {jellyfinItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-3 px-2 w-full rounded-lg transition-colors",
                  item.active && "text-mythic bg-mythic/10"
                )}
                onClick={() => handleItemClick(item)}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">NAS</span>
              </Button>
            ))}
          </>
        )}
        <div className="mt-auto">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-3 px-2 w-full rounded-lg"
            onClick={handleSettingsClick}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] leading-tight">Settings</span>
          </Button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border/50 bg-sidebar/80 backdrop-blur-sm hidden md:block">
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="py-2">
          {/* Main */}
          <div className="px-2">
            {mainItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-4 px-3 py-2 h-9 font-normal rounded-lg transition-all duration-200",
                  item.active && "bg-mythic/10 text-mythic font-medium border-l-2 border-mythic"
                )}
                onClick={() => handleItemClick(item)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>

          <Separator className="my-2 bg-white/5" />

          {/* Categories */}
          <div className="px-2">
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Categories</p>
            {categoryItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-4 px-3 py-2 h-9 font-normal rounded-lg transition-all duration-200",
                  item.active && "bg-mythic/10 text-mythic font-medium border-l-2 border-mythic"
                )}
                onClick={() => handleItemClick(item)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>

          {/* Jellyfin Section */}
          {jellyfinConnected && (
            <>
              <Separator className="my-2 bg-white/5" />
              <div className="px-2">
                <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5">
                  <Server className="h-3 w-3" />
                  NAS Server
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot ml-auto" />
                </p>
                {/* Browse all */}
                {jellyfinItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-4 px-3 py-2 h-9 font-normal rounded-lg transition-all duration-200",
                      item.active && "bg-mythic/10 text-mythic font-medium border-l-2 border-mythic"
                    )}
                    onClick={() => handleItemClick(item)}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                    <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0 h-4 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      Online
                    </Badge>
                  </Button>
                ))}
                {/* Individual libraries */}
                {jellyfinLibraries.length > 0 && (
                  <div className="ml-2 mt-1">
                    {jellyfinLibraries.map((lib) => {
                      const IconComp = collectionTypeIcons[lib.collectionType] || Film
                      const mediaType = collectionTypeToMediaType[lib.collectionType]
                      const isActive = activeCategory === mediaType
                      return (
                        <Button
                          key={lib.id}
                          variant="ghost"
                          className={cn(
                            "w-full justify-start gap-3 px-3 py-1.5 h-8 font-normal text-xs rounded-lg transition-all duration-200",
                            isActive && "bg-mythic/10 text-mythic font-medium border-l-2 border-mythic"
                          )}
                          onClick={() => {
                            setCurrentMedia(null)
                            setSearchQuery('')
                            setIsSearching(false)
                            setActiveCategory(mediaType)
                          }}
                        >
                          <IconComp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{lib.name}</span>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="my-2 bg-white/5" />

          {/* Bottom */}
          <div className="px-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-4 px-3 py-2 h-9 font-normal rounded-lg"
              onClick={handleSettingsClick}
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span>Settings</span>
            </Button>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 text-[10px] text-muted-foreground/40">
            <p>&copy; 2025 MyTube</p>
            <p className="mt-0.5">Premium streaming platform</p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
