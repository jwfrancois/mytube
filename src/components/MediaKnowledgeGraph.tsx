'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Network,
  X,
  ChevronRight,
  Search,
  Sparkles,
  AlertCircle,
  Film,
  Tv,
  Music,
  Mic,
  Headphones,
  Users,
  Tag,
  Link2,
  ArrowLeft,
  RotateCcw,
  User,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeGraphPerson {
  id: string
  name: string
  role: string
  type: string
  thumbnail: string
  items: MediaItem[]
}

interface KnowledgeGraphGenre {
  name: string
  items: MediaItem[]
}

interface KnowledgeGraphData {
  center: MediaItem
  people: KnowledgeGraphPerson[]
  genres: KnowledgeGraphGenre[]
  related: MediaItem[]
}

interface BreadcrumbEntry {
  itemId: string
  title: string
}

interface MediaKnowledgeGraphProps {
  onPlay: (item: MediaItem) => void
  onClose: () => void
}

// --- Search Results Type ---

interface SearchResult {
  id: string
  title: string
  type: string
  thumbnail: string
  genre: string
  releaseYear: number
  jellyfinId: string
  isJellyfin: boolean
  hasChildren: boolean
  itemType?: string
}

export function MediaKnowledgeGraph({ onPlay, onClose }: MediaKnowledgeGraphProps) {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([])
  const [activeSection, setActiveSection] = useState<'people' | 'genres' | 'related' | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<KnowledgeGraphPerson | null>(null)
  const [selectedGenre, setSelectedGenre] = useState<KnowledgeGraphGenre | null>(null)
  const { mediaItems } = useAppStore()

  // Fetch the knowledge graph for a given item
  const fetchGraph = useCallback(async (itemId: string) => {
    setIsLoading(true)
    setError(null)
    setActiveSection(null)
    setSelectedPerson(null)
    setSelectedGenre(null)

    try {
      const res = await fetch(`/api/ai/knowledge-graph?itemId=${itemId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load knowledge graph')
      }

      const data: KnowledgeGraphData = await res.json()
      setGraphData(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Search for items to start the graph
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchResults([])

    try {
      const res = await fetch(`/api/jellyfin/items?searchTerm=${encodeURIComponent(searchQuery)}&Limit=20`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.media || [])
      }
    } catch {
      // Try local items as fallback
      const filtered = mediaItems.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
      setSearchResults(filtered as any)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, mediaItems])

  // Select an item to center the graph
  const handleSelectItem = useCallback((item: SearchResult | MediaItem) => {
    const jellyfinId = item.jellyfinId || item.id.replace('jf-', '')
    if (breadcrumbs.length === 0 || breadcrumbs[breadcrumbs.length - 1].itemId !== jellyfinId) {
      setBreadcrumbs(prev => [...prev, { itemId: jellyfinId, title: item.title }])
    }
    fetchGraph(jellyfinId)
  }, [breadcrumbs, fetchGraph])

  // Navigate to a person's other items
  const handlePersonClick = useCallback((person: KnowledgeGraphPerson) => {
    setSelectedPerson(person)
    setSelectedGenre(null)
    setActiveSection('people')
  }, [])

  // Navigate to a genre's items
  const handleGenreClick = useCallback((genre: KnowledgeGraphGenre) => {
    setSelectedGenre(genre)
    setSelectedPerson(null)
    setActiveSection('genres')
  }, [])

  // Navigate back in breadcrumbs
  const handleBreadcrumbClick = useCallback((index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1)
    setBreadcrumbs(newBreadcrumbs)
    const entry = newBreadcrumbs[newBreadcrumbs.length - 1]
    fetchGraph(entry.itemId)
  }, [breadcrumbs, fetchGraph])

  // Navigate back from person/genre detail
  const handleBackToGraph = useCallback(() => {
    setActiveSection(null)
    setSelectedPerson(null)
    setSelectedGenre(null)
  }, [])

  // Pick from trending/popular items
  const trendingItems = mediaItems
    .filter(i => i.thumbnail && (i.type === 'MOVIE' || i.type === 'TV_SHOW'))
    .sort((a, b) => (b.communityRating || 0) - (a.communityRating || 0))
    .slice(0, 12)

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MOVIE': return Film
      case 'TV_SHOW': return Tv
      case 'MUSIC': return Music
      case 'PODCAST': return Mic
      case 'AUDIOBOOK': return Headphones
      default: return Film
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 h-9 w-9 rounded-lg hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15">
              <Network className="h-4 w-4 text-purple-400" />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Knowledge Graph</h1>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 ml-2 text-xs text-muted-foreground/60">
              {breadcrumbs.map((entry, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className={cn(
                      "hover:text-purple-300 transition-colors truncate max-w-[120px]",
                      i === breadcrumbs.length - 1 && "text-purple-300 font-medium"
                    )}
                  >
                    {entry.title}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="flex-1 max-w-md ml-auto">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a movie, show, or album..."
                className="h-8 text-xs bg-white/5 border-white/10 focus:border-purple-400/50 rounded-lg"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                size="sm"
                className="h-8 px-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 gap-1.5 shrink-0"
              >
                {isSearching ? (
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="flex sm:hidden items-center gap-1 px-4 pb-2 text-xs text-muted-foreground/60 overflow-x-auto">
            {breadcrumbs.map((entry, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                <button
                  onClick={() => handleBreadcrumbClick(i)}
                  className={cn(
                    "hover:text-purple-300 transition-colors truncate max-w-[100px]",
                    i === breadcrumbs.length - 1 && "text-purple-300 font-medium"
                  )}
                >
                  {entry.title}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 py-6">
        {/* Initial State: No graph loaded */}
        {!graphData && !isLoading && !error && (
          <div>
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground/60 mb-3">Search Results</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {searchResults.map((item) => {
                    const TypeIcon = getTypeIcon(item.type)
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className="group text-left rounded-xl overflow-hidden bg-white/3 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-300"
                      >
                        <div className="aspect-video relative overflow-hidden bg-muted">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <TypeIcon className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Network className="h-8 w-8 text-white/80" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-medium truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground/50 truncate">{item.type} {item.releaseYear ? `(${item.releaseYear})` : ''}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trending Items to pick from */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h2 className="text-base font-bold">Pick an item to explore</h2>
              </div>
              <p className="text-xs text-muted-foreground/50 mb-4">
                Select any movie, show, or album to discover its connections — actors, genres, and related content.
              </p>
              {trendingItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {trendingItems.map((item) => {
                    const TypeIcon = getTypeIcon(item.type)
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className="group text-left rounded-xl overflow-hidden bg-white/3 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-300"
                      >
                        <div className="aspect-video relative overflow-hidden bg-muted">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <TypeIcon className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Network className="h-8 w-8 text-white/80" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-medium truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground/50 truncate">{item.genre}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Network className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/50">Connect to Jellyfin to explore your media knowledge graph</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            {/* Central card skeleton */}
            <div className="flex flex-col sm:flex-row gap-5 p-5 rounded-2xl bg-white/3 border border-white/5">
              <Skeleton className="w-full sm:w-48 aspect-video rounded-xl shimmer" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-3/4 shimmer" />
                <Skeleton className="h-4 w-1/2 shimmer" />
                <Skeleton className="h-4 w-2/3 shimmer" />
                <div className="flex gap-2 mt-3">
                  <Skeleton className="h-6 w-16 rounded-full shimmer" />
                  <Skeleton className="h-6 w-16 rounded-full shimmer" />
                  <Skeleton className="h-6 w-16 rounded-full shimmer" />
                </div>
              </div>
            </div>
            {/* People skeletons */}
            <div>
              <Skeleton className="h-5 w-24 mb-3 shimmer" />
              <div className="flex gap-3 overflow-x-auto pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-20 flex flex-col items-center gap-2">
                    <Skeleton className="h-16 w-16 rounded-full shimmer" />
                    <Skeleton className="h-3 w-12 shimmer" />
                  </div>
                ))}
              </div>
            </div>
            {/* Related skeletons */}
            <div>
              <Skeleton className="h-5 w-32 mb-3 shimmer" />
              <div className="flex gap-3 overflow-x-auto pb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[200px] space-y-2">
                    <Skeleton className="aspect-video rounded-lg w-full shimmer" />
                    <Skeleton className="h-3 w-3/4 shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center gap-3 p-5 rounded-xl bg-red-500/5 border border-red-500/15 max-w-lg mx-auto mt-12">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => graphData?.center?.jellyfinId && fetchGraph(graphData.center.jellyfinId)}
              className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Graph Data */}
        {graphData && !isLoading && !error && (
          <div className="space-y-6">
            {/* Person/Genre Detail View */}
            {activeSection === 'people' && selectedPerson && (
              <div>
                <button
                  onClick={handleBackToGraph}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-purple-300 transition-colors mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to {graphData.center.title}
                </button>
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15 shrink-0">
                    {selectedPerson.thumbnail ? (
                      <img
                        src={selectedPerson.thumbnail}
                        alt={selectedPerson.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-7 w-7 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedPerson.name}</h2>
                    <p className="text-xs text-muted-foreground/60">{selectedPerson.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Film className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-semibold">Other works</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-300 border-purple-500/20">
                    {selectedPerson.items.length}
                  </Badge>
                </div>
                {selectedPerson.items.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
                    {selectedPerson.items.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px]">
                        <MediaCard item={item} onPlay={onPlay} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50">No other items found for this person.</p>
                )}
              </div>
            )}

            {activeSection === 'genres' && selectedGenre && (
              <div>
                <button
                  onClick={handleBackToGraph}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-purple-300 transition-colors mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to {graphData.center.title}
                </button>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/15">
                    <Tag className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedGenre.name}</h2>
                    <p className="text-xs text-muted-foreground/60">{selectedGenre.items.length} items in this genre</p>
                  </div>
                </div>
                {selectedGenre.items.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
                    {selectedGenre.items.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px]">
                        <MediaCard item={item} onPlay={onPlay} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50">No other items found in this genre.</p>
                )}
              </div>
            )}

            {/* Main Graph View */}
            {!activeSection && (
              <>
                {/* Central Card */}
                <div className={cn(
                  "relative overflow-hidden rounded-2xl p-5 sm:p-6",
                  "bg-gradient-to-br from-purple-500/10 via-pink-500/8 to-purple-600/5",
                  "border border-purple-500/20",
                  "backdrop-blur-xl"
                )}>
                  <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
                  <div className="absolute bottom-0 left-0 w-36 h-36 bg-pink-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

                  <div className="relative z-10 flex flex-col sm:flex-row gap-5">
                    {/* Thumbnail */}
                    <div className="w-full sm:w-48 shrink-0">
                      <div className="aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
                        {graphData.center.thumbnail ? (
                          <img
                            src={graphData.center.thumbnail}
                            alt={graphData.center.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-300 border-purple-500/20"
                        >
                          {graphData.center.type}
                        </Badge>
                        {graphData.center.releaseYear > 0 && (
                          <span className="text-xs text-muted-foreground/50">{graphData.center.releaseYear}</span>
                        )}
                        {graphData.center.communityRating && (
                          <span className="text-xs text-amber-400">{graphData.center.communityRating.toFixed(1)}</span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">{graphData.center.title}</h2>
                      {graphData.center.artist && (
                        <p className="text-xs text-muted-foreground/60 mb-2">{graphData.center.artist}</p>
                      )}
                      <p className="text-xs text-muted-foreground/50 line-clamp-3 mb-3">{graphData.center.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(graphData.center.genre || '').split(', ').filter(Boolean).map(g => (
                          <Badge
                            key={g}
                            variant="outline"
                            className="text-[10px] px-2 py-0 h-5 bg-white/5 border-white/10 text-muted-foreground/60 cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/20 transition-colors"
                            onClick={() => {
                              const genreData = graphData.genres.find(gd => gd.name === g)
                              if (genreData) handleGenreClick(genreData)
                            }}
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                      {/* Connection summary */}
                      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground/50">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {graphData.people.length} people
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {graphData.genres.length} genres
                        </span>
                        <span className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {graphData.related.length} related
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* People Row */}
                {graphData.people.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-semibold">People</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-300 border-purple-500/20">
                        {graphData.people.length}
                      </Badge>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 shelf-scrollbar">
                      {graphData.people.map((person, i) => (
                        <button
                          key={`${person.id}-${i}`}
                          onClick={() => handlePersonClick(person)}
                          className="group shrink-0 flex flex-col items-center gap-2 w-20 text-center"
                        >
                          <div className={cn(
                            "relative w-16 h-16 rounded-full overflow-hidden",
                            "border-2 border-white/10",
                            "group-hover:border-purple-400/50 group-hover:shadow-lg group-hover:shadow-purple-500/20",
                            "transition-all duration-300"
                          )}>
                            {person.thumbnail ? (
                              <img
                                src={person.thumbnail}
                                alt={person.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                                <User className="h-6 w-6 text-purple-400/60" />
                              </div>
                            )}
                            {/* Click indicator */}
                            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 transition-colors flex items-center justify-center">
                              <ChevronRight className="h-4 w-4 text-white/0 group-hover:text-white/60 transition-colors" />
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium truncate w-20 leading-tight">{person.name}</p>
                            <p className="text-[9px] text-muted-foreground/40 truncate w-20">{person.role || person.type}</p>
                          </div>
                          {/* Connection count */}
                          {person.items.length > 0 && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-white/5 border-white/10 text-muted-foreground/40">
                              {person.items.length} other
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Genres Row */}
                {graphData.genres.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold">Genres</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {graphData.genres.map((genre) => (
                        <button
                          key={genre.name}
                          onClick={() => handleGenreClick(genre)}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-full",
                            "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300",
                            "hover:bg-emerald-500/20 hover:border-emerald-500/30",
                            "transition-all duration-200 cursor-pointer",
                            "flex items-center gap-1.5"
                          )}
                        >
                          <Tag className="h-3 w-3" />
                          {genre.name}
                          {genre.items.length > 0 && (
                            <span className="text-[10px] text-emerald-400/60">({genre.items.length})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Items Row */}
                {graphData.related.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="h-4 w-4 text-pink-400" />
                      <h3 className="text-sm font-semibold">Related</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-pink-500/10 text-pink-300 border-pink-500/20">
                        {graphData.related.length}
                      </Badge>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
                      {graphData.related.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px] group/card">
                          <MediaCard item={item} onPlay={onPlay} />
                          {/* Navigate button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectItem(item)
                            }}
                            className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-purple-300 transition-colors"
                          >
                            <Network className="h-3 w-3" />
                            Explore connections
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
