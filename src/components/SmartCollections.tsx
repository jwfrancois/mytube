'use client'

import { useState, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Wand2,
  Sparkles,
  Trophy,
  Skull,
  Gem,
  Users,
  Clock,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Music,
  Tv,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface SmartCollection {
  id: string
  title: string
  description: string
  items: MediaItem[]
  icon: string
}

interface SmartCollectionsProps {
  onPlay: (item: MediaItem) => void
}

// --- Pre-defined Quick Access Collection Chips ---

const QUICK_COLLECTIONS = [
  { type: 'oscar' as const, label: 'Oscar Winners', icon: Trophy, gradient: 'from-amber-500/80 to-yellow-600/80' },
  { type: 'cult_classic' as const, label: 'Cult Classics', icon: Skull, gradient: 'from-gray-600/80 to-gray-800/80' },
  { type: 'hidden_gems' as const, label: 'Hidden Gems', icon: Gem, gradient: 'from-emerald-500/80 to-teal-600/80' },
  { type: 'family' as const, label: 'Family Favorites', icon: Users, gradient: 'from-orange-500/80 to-rose-500/80' },
  { type: 'decade_90s' as const, label: '90s Movies', icon: Clock, gradient: 'from-rose-500/80 to-pink-600/80' },
]

// --- Icon mapping for collection cards ---

function getCollectionIcon(iconName: string) {
  const iconMap: Record<string, React.ElementType> = {
    trophy: Trophy,
    skull: Skull,
    gem: Gem,
    users: Users,
    clock: Clock,
    film: Film,
    music: Music,
    tv: Tv,
    sparkles: Sparkles,
    wand: Wand2,
  }
  return iconMap[iconName?.toLowerCase()] || Sparkles
}

// --- Gradient mapping for collection themes ---

const COLLECTION_GRADIENTS = [
  'from-purple-600/80 to-pink-600/80',
  'from-amber-600/80 to-orange-600/80',
  'from-emerald-600/80 to-teal-600/80',
  'from-rose-600/80 to-red-600/80',
  'from-cyan-600/80 to-sky-600/80',
  'from-orange-600/80 to-amber-600/80',
  'from-violet-600/80 to-purple-600/80',
  'from-pink-600/80 to-rose-600/80',
]

// --- Main Component ---

export function SmartCollections({ onPlay }: SmartCollectionsProps) {
  const [collections, setCollections] = useState<SmartCollection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchCollections = useCallback(async (collectionType: string) => {
    setIsLoading(true)
    setError(null)
    setHasLoaded(true)

    try {
      const res = await fetch('/api/ai/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionType }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch collections')
      }

      const data = await res.json()

      if (collectionType === 'auto') {
        // Replace all collections with new auto-generated ones
        setCollections(data.collections || [])
      } else {
        // For specific types, add/replace the matching collection
        const newCollections = data.collections || []
        if (newCollections.length > 0) {
          setCollections((prev) => {
            // Replace if a collection of the same type already exists
            const existingIndex = prev.findIndex((c) => c.id.startsWith(collectionType))
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = newCollections[0]
              return updated
            }
            return [...prev, ...newCollections]
          })
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleQuickCollection = useCallback((type: string) => {
    fetchCollections(type)
  }, [fetchCollections])

  const handleGenerateMore = useCallback(() => {
    fetchCollections('auto')
  }, [fetchCollections])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="px-6 mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15">
            <Wand2 className="h-4.5 w-4.5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Smart Collections</h2>
            <p className="text-[11px] text-muted-foreground/60">AI-curated collections from your library</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerateMore}
          disabled={isLoading}
          className={cn(
            "gap-1.5 text-xs",
            "text-purple-300 hover:text-purple-200 hover:bg-purple-500/10",
            "disabled:opacity-40"
          )}
        >
          {isLoading ? (
            <div className="h-3.5 w-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate More
        </Button>
      </div>

      {/* Quick Access Chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_COLLECTIONS.map((qc) => {
          const Icon = qc.icon
          return (
            <button
              key={qc.type}
              onClick={() => handleQuickCollection(qc.type)}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                "bg-white/5 border border-white/10",
                "text-muted-foreground/70 hover:text-white",
                "hover:bg-gradient-to-r",
                qc.gradient,
                "hover:border-white/20",
                "transition-all duration-200 cursor-pointer",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <Icon className="h-3 w-3" />
              {qc.label}
            </button>
          )
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15 mb-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateMore}
            className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && collections.length === 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[280px] h-[180px] rounded-xl overflow-hidden">
              <Skeleton className="w-full h-full shimmer" />
            </div>
          ))}
        </div>
      )}

      {/* Collection Cards */}
      {collections.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
          {collections.map((collection, idx) => {
            const Icon = getCollectionIcon(collection.icon)
            const gradient = COLLECTION_GRADIENTS[idx % COLLECTION_GRADIENTS.length]
            const isExpanded = expandedId === collection.id

            return (
              <div key={collection.id} className="shrink-0">
                {/* Collection Card */}
                <button
                  onClick={() => toggleExpanded(collection.id)}
                  className={cn(
                    "relative w-[280px] h-[180px] rounded-xl overflow-hidden text-left",
                    "bg-gradient-to-br",
                    gradient,
                    "transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30",
                    "active:scale-[0.99]",
                    "cursor-pointer",
                    isExpanded && "ring-2 ring-white/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  {/* Decorative blur */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/3 translate-x-1/4" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/4" />

                  <div className="relative z-10 h-full flex flex-col justify-between p-4">
                    <div>
                      <Icon className="h-7 w-7 text-white/80 mb-2" />
                      <h3 className="text-base font-bold text-white/95 leading-tight">{collection.title}</h3>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 line-clamp-2 mb-2">{collection.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 bg-white/10 text-white/70 border-white/20"
                        >
                          {collection.items.length} item{collection.items.length !== 1 ? 's' : ''}
                        </Badge>
                        <div className="text-white/40">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Items */}
                {isExpanded && collection.items.length > 0 && (
                  <div
                    className={cn(
                      "mt-3 animate-in slide-in-from-top-2 duration-300",
                      "bg-white/5 rounded-xl p-3",
                      "border border-white/5"
                    )}
                  >
                    <div className="flex gap-3 overflow-x-auto pb-1 shelf-scrollbar">
                      {collection.items.map((item, itemIdx) => (
                        <div key={`${item.id}-${itemIdx}`} className="shrink-0 w-[160px] sm:w-[180px]">
                          <MediaCard item={item} onPlay={onPlay} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && hasLoaded && collections.length === 0 && (
        <div className="text-center py-8">
          <Wand2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">No collections generated yet. Try clicking a category above or Generate More.</p>
        </div>
      )}

      {/* Initial State - Prompt to get started */}
      {!isLoading && !error && !hasLoaded && (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">Click a category above or Generate More to discover smart collections.</p>
        </div>
      )}
    </div>
  )
}
