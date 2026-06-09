'use client'

import { useAppStore, MediaType } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Play,
  Server,
  ChevronRight,
  FolderOpen,
  Loader2,
  Tv,
  Film,
  Music,
  Mic,
  BookOpen,
  Layers,
  Star,
  Calendar,
  Clock,
} from 'lucide-react'
import { useEffect, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const typeColors: Record<string, string> = {
  MOVIE: 'bg-red-500/10 text-red-500 border-red-500/20',
  TV_SHOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  MUSIC: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  PODCAST: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  AUDIOBOOK: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  COLLECTION: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
}

const typeLabels: Record<string, string> = {
  TV_SHOW: 'TV Show',
  PODCAST: 'Podcast',
  AUDIOBOOK: 'Audiobook',
  COLLECTION: 'Collection',
  MUSIC: 'Music',
  MOVIE: 'Movie',
}

const itemTypeLabels: Record<string, string> = {
  Series: 'TV Series',
  Season: 'Season',
  Episode: 'Episode',
  Movie: 'Movie',
  Audio: 'Track',
  MusicAlbum: 'Album',
  MusicArtist: 'Artist',
  Book: 'Audiobook',
  BoxSet: 'Collection',
  Playlist: 'Playlist',
}

export function SeriesDetail() {
  const {
    selectedSeries,
    setSelectedSeries,
    seriesSeasons,
    setSeriesSeasons,
    seriesEpisodes,
    setSeriesEpisodes,
    selectedSeason,
    setSelectedSeason,
    seriesLoading,
    setSeriesLoading,
    setCurrentMedia,
  } = useAppStore()

  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'seasons' | 'episodes' | 'items'>('seasons')

  // Fetch seasons when a TV show is selected
  const fetchSeasons = useCallback(async (seriesId: string) => {
    setSeriesLoading(true)
    setSeriesSeasons([])
    setSeriesEpisodes([])
    setSelectedSeason(null)
    try {
      const res = await fetch(`/api/jellyfin/seasons/${seriesId}`)
      const data = await res.json()
      setSeriesSeasons(data.seasons || [])
      if ((data.seasons || []).length === 1) {
        // Auto-select the only season
        const onlySeason = data.seasons[0]
        setSelectedSeason(onlySeason)
        fetchEpisodes(seriesId, onlySeason.jellyfinId)
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err)
    } finally {
      setSeriesLoading(false)
    }
  }, [setSeriesSeasons, setSeriesEpisodes, setSelectedSeason, setSeriesLoading])

  // Fetch episodes for a season (TV shows)
  const fetchEpisodes = useCallback(async (seriesId: string, seasonId: string) => {
    setSeriesLoading(true)
    setSeriesEpisodes([])
    try {
      const res = await fetch(`/api/jellyfin/episodes?seriesId=${seriesId}&seasonId=${seasonId}`)
      const data = await res.json()
      setSeriesEpisodes(data.episodes || [])
      setViewMode('episodes')
    } catch (err) {
      console.error('Failed to fetch episodes:', err)
    } finally {
      setSeriesLoading(false)
    }
  }, [setSeriesEpisodes, setSeriesLoading])

  // Fetch children for a collection/podcast/album
  const fetchChildren = useCallback(async (parentId: string, podcastParentId?: string, podcastAudioIds?: string[], albumKey?: string, podcastArtistId?: string, podcastLibraryId?: string) => {
    setSeriesLoading(true)
    setSeriesEpisodes([])
    try {
      let url = `/api/jellyfin/episodes?parentId=${parentId}`
      // For artist-based podcast series (from /Artists endpoint), use the artist-specific endpoint
      if (podcastArtistId) {
        url = `/api/jellyfin/episodes?podcastArtistId=${podcastArtistId}`
        if (podcastLibraryId) {
          url += `&podcastLibraryId=${podcastLibraryId}`
        }
      }
      // For virtual podcast series (grouped by album), use the podcast-specific endpoint
      else if (podcastParentId) {
        url = `/api/jellyfin/episodes?podcastParentId=${podcastParentId}`
        if (podcastAudioIds && podcastAudioIds.length > 0) {
          url += `&podcastAudioIds=${podcastAudioIds.join(',')}`
        }
      }
      const res = await fetch(url)
      const data = await res.json()
      setSeriesEpisodes(data.episodes || [])
      // Update childCount for the series if we have a total count
      if (data.totalCount && selectedSeries) {
        selectedSeries.childCount = data.totalCount
      }
      setViewMode('items')
    } catch (err) {
      console.error('Failed to fetch children:', err)
    } finally {
      setSeriesLoading(false)
    }
  }, [setSeriesEpisodes, setSeriesLoading, selectedSeries])

  // Initialize when selectedSeries changes
  useEffect(() => {
    if (!selectedSeries) return

    const type = selectedSeries.type
    const jellyfinId = selectedSeries.jellyfinId

    if (!jellyfinId) return

    if (type === 'TV_SHOW') {
      // TV Show: fetch seasons first
      setViewMode('seasons')
      fetchSeasons(jellyfinId)
    } else if (type === 'PODCAST') {
      // Podcast: check how the series was created
      setViewMode('items')
      const podcastParentId = selectedSeries._parentId || selectedSeries.parentId
      const podcastAudioIds = selectedSeries._podcastAudioIds
      const podcastArtistId = selectedSeries._podcastArtistId
      const podcastLibraryId = selectedSeries._parentId || selectedSeries.parentId
      if (jellyfinId.startsWith('pa-') && podcastArtistId) {
        // Artist-based podcast series (from /Artists endpoint) - use artist-specific endpoint
        fetchChildren(jellyfinId, undefined, undefined, undefined, podcastArtistId, podcastLibraryId)
      } else if (jellyfinId.startsWith('ps-') && podcastParentId) {
        // Virtual podcast series (grouped by album) - use podcast-specific endpoint with audio IDs
        fetchChildren(jellyfinId, podcastParentId, podcastAudioIds)
      } else {
        // Real folder/series - use standard children fetch
        fetchChildren(jellyfinId)
      }
    } else if (type === 'COLLECTION' || type === 'MUSIC') {
      // Collection/Music: fetch children directly
      setViewMode('items')
      fetchChildren(jellyfinId)
    } else if (type === 'AUDIOBOOK') {
      // Audiobook: might have chapters or be directly playable
      if (selectedSeries.hasChildren) {
        setViewMode('items')
        fetchChildren(jellyfinId)
      } else {
        // Play directly
        setCurrentMedia(selectedSeries)
      }
    }
  }, [selectedSeries?.id])

  const handleBack = () => {
    if (viewMode === 'episodes' && selectedSeason) {
      // Go back to seasons view
      setSelectedSeason(null)
      setSeriesEpisodes([])
      setViewMode('seasons')
    } else {
      // Go back to main grid
      setSelectedSeries(null)
      setSeriesSeasons([])
      setSeriesEpisodes([])
      setSelectedSeason(null)
    }
  }

  const handlePlayItem = (item: any) => {
    // For items with children, navigate into them
    if (item.hasChildren) {
      if (item.type === 'TV_SHOW' || item.itemType === 'Season') {
        // It's a season - fetch its episodes
        setSelectedSeason(item)
        fetchEpisodes(selectedSeries?.jellyfinId || '', item.jellyfinId)
      } else {
        // It's a collection/podcast - fetch its children
        fetchChildren(item.jellyfinId)
      }
      return
    }

    // For playable items, enrich with series info for the player
    const enrichedItem = {
      ...item,
      channel: selectedSeries?.title || item.channel,
    }

    // If this is audio content (music, podcast, audiobook), set up the play queue
    const isAudio = item.mediaType === 'audio' || item.type === 'MUSIC' || item.type === 'PODCAST' || item.type === 'AUDIOBOOK'
    if (isAudio && seriesEpisodes.length > 0) {
      const currentIndex = seriesEpisodes.findIndex(e => e.id === item.id)
      const queue = seriesEpisodes.map(ep => ({
        ...ep,
        channel: selectedSeries?.title || ep.channel,
      }))
      useAppStore.getState().setPlayQueue(queue)
      if (currentIndex >= 0) {
        useAppStore.getState().setQueueIndex(currentIndex)
      }
      toast({ title: `Added ${queue.length} items to queue` })
    }

    setCurrentMedia(enrichedItem)
  }

  if (!selectedSeries) return null

  const seriesType = selectedSeries.type as MediaType

  // Get the icon for the series type
  const getSeriesIcon = () => {
    switch (seriesType) {
      case 'TV_SHOW': return <Tv className="h-5 w-5" />
      case 'PODCAST': return <Mic className="h-5 w-5" />
      case 'AUDIOBOOK': return <BookOpen className="h-5 w-5" />
      case 'COLLECTION': return <Layers className="h-5 w-5" />
      case 'MUSIC': return <Music className="h-5 w-5" />
      default: return <Film className="h-5 w-5" />
    }
  }

  // Get the sub-items label
  const getSubItemsLabel = () => {
    switch (seriesType) {
      case 'TV_SHOW': return viewMode === 'seasons' ? 'Seasons' : 'Episodes'
      case 'PODCAST': return 'Episodes'
      case 'AUDIOBOOK': return 'Chapters'
      case 'COLLECTION': return 'Movies in Collection'
      case 'MUSIC': return 'Tracks'
      default: return 'Items'
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-3 -ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Series Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Poster */}
          <div className="w-full md:w-48 shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted">
              {selectedSeries.thumbnail ? (
                <img
                  src={selectedSeries.thumbnail}
                  alt={selectedSeries.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                  {getSeriesIcon()}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={cn("text-xs", typeColors[seriesType] || typeColors.MOVIE)}>
                {typeLabels[seriesType] || seriesType}
              </Badge>
              {selectedSeries.isJellyfin && (
                <Badge variant="outline" className="text-xs gap-1 text-emerald-500 border-emerald-500/30">
                  <Server className="h-3 w-3" />
                  NAS
                </Badge>
              )}
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">{selectedSeries.title}</h1>

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
              {selectedSeries.releaseYear > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {selectedSeries.releaseYear}
                </span>
              )}
              {selectedSeries.communityRating && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {selectedSeries.communityRating.toFixed(1)}
                </span>
              )}
              {selectedSeries.childCount > 0 && (
                <span className="flex items-center gap-1">
                  {seriesType === 'TV_SHOW' ? (
                    <>{selectedSeries.childCount} seasons</>
                  ) : seriesType === 'COLLECTION' ? (
                    <>{selectedSeries.childCount} movies</>
                  ) : seriesType === 'PODCAST' ? (
                    <>{selectedSeries.childCount} episodes</>
                  ) : (
                    <>{selectedSeries.childCount} items</>
                  )}
                </span>
              )}
              {selectedSeries.genre && (
                <Badge variant="outline" className="text-xs">{selectedSeries.genre}</Badge>
              )}
            </div>

            {selectedSeries.description && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                {selectedSeries.description}
              </p>
            )}
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Breadcrumb for TV shows */}
        {seriesType === 'TV_SHOW' && (viewMode === 'episodes' || selectedSeason) && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => {
                setSelectedSeason(null)
                setSeriesEpisodes([])
                setViewMode('seasons')
              }}
            >
              Seasons
            </Button>
            {selectedSeason && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-sm">{selectedSeason.title}</span>
                {seriesEpisodes.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {seriesEpisodes.length} episodes
                  </Badge>
                )}
              </>
            )}
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{getSubItemsLabel()}</h2>
          {seriesLoading && (
            <div className="flex items-center gap-2 text-emerald-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {seriesLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video rounded-xl w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Seasons Grid (TV Shows) */}
        {!seriesLoading && viewMode === 'seasons' && seriesType === 'TV_SHOW' && (
          <>
            {seriesSeasons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Tv className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No seasons found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {seriesSeasons.map((season) => (
                  <SeasonCard
                    key={season.id}
                    item={season}
                    onClick={() => handlePlayItem(season)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Episodes List (TV Shows) */}
        {!seriesLoading && viewMode === 'episodes' && seriesType === 'TV_SHOW' && (
          <>
            {seriesEpisodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Tv className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No episodes found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {seriesEpisodes.map((episode, index) => (
                  <EpisodeCard
                    key={episode.id}
                    item={episode}
                    index={index}
                    onClick={() => handlePlayItem(episode)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Items List (Collections, Podcasts, Music) */}
        {!seriesLoading && viewMode === 'items' && (
          <>
            {seriesEpisodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No items found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {seriesEpisodes.map((item, index) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    onClick={() => handlePlayItem(item)}
                    seriesType={seriesType}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Season Card for TV Shows
function SeasonCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <Card
      className="group cursor-pointer border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden bg-card"
      onClick={onClick}
    >
      <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <Tv className="h-10 w-10 text-emerald-500/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
              <ChevronRight className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        {item.childCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {item.childCount} episodes
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-1">{item.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Season {item.indexNumber || item.parentIndexNumber}
        </p>
      </div>
    </Card>
  )
}

// Episode Card for TV Shows - YouTube-like list
function EpisodeCard({ item, index, onClick }: { item: any; index: number; onClick: () => void }) {
  return (
    <div
      className="group flex gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
      onClick={onClick}
    >
      {/* Episode Thumbnail */}
      <div className="relative w-48 sm:w-56 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <Tv className="h-8 w-8 text-emerald-500/30" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 bg-black/70 rounded-full flex items-center justify-center">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        {/* Duration */}
        {item.duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-medium">
            {item.duration}
          </div>
        )}
        {/* Episode number overlay */}
        {item.indexNumber && (
          <div className="absolute top-1 left-1 bg-emerald-500/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            E{item.indexNumber}
          </div>
        )}
      </div>

      {/* Episode Info */}
      <div className="flex-1 min-w-0 py-1">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {item.parentIndexNumber && `S${item.parentIndexNumber}`}E{item.indexNumber || index + 1}
          {item.duration && ` • ${item.duration}`}
        </p>
        {item.communityRating && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-muted-foreground">{item.communityRating.toFixed(1)}</span>
          </div>
        )}
        {item.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </div>
  )
}

// Generic Item Card for Collections, Podcasts, Music
function ItemCard({ item, index, onClick, seriesType }: { item: any; index: number; onClick: () => void; seriesType: string }) {
  const getItemIcon = () => {
    switch (item.type) {
      case 'PODCAST': return <Mic className="h-8 w-8 text-orange-500/30" />
      case 'AUDIOBOOK': return <BookOpen className="h-8 w-8 text-amber-500/30" />
      case 'MUSIC': return <Music className="h-8 w-8 text-purple-500/30" />
      default: return <Film className="h-8 w-8 text-red-500/30" />
    }
  }

  const getItemBadge = () => {
    switch (item.type) {
      case 'PODCAST': return typeColors.PODCAST
      case 'AUDIOBOOK': return typeColors.AUDIOBOOK
      case 'MUSIC': return typeColors.MUSIC
      case 'TV_SHOW': return typeColors.TV_SHOW
      case 'COLLECTION': return typeColors.COLLECTION
      default: return typeColors.MOVIE
    }
  }

  const isAudio = item.mediaType === 'audio' || item.type === 'PODCAST' || item.type === 'AUDIOBOOK' || item.type === 'MUSIC'

  return (
    <div
      className="group flex gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
      onClick={onClick}
    >
      {/* Item Thumbnail */}
      <div className={cn(
        "relative shrink-0 rounded-lg overflow-hidden bg-muted",
        isAudio ? "w-16 h-16" : "w-40 sm:w-48 aspect-video"
      )}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            {getItemIcon()}
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {item.hasChildren ? (
              <div className="w-8 h-8 bg-black/70 rounded-full flex items-center justify-center">
                <ChevronRight className="h-4 w-4 text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-black/70 rounded-full flex items-center justify-center">
                <Play className="h-4 w-4 text-white fill-white ml-0.5" />
              </div>
            )}
          </div>
        </div>
        {/* Duration */}
        {item.duration && !isAudio && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-medium">
            {item.duration}
          </div>
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center gap-2 mb-1">
          {item.indexNumber && (
            <span className="text-xs font-medium text-muted-foreground">
              {seriesType === 'PODCAST' ? `Ep. ${item.indexNumber}` : `#${item.indexNumber}`}
            </span>
          )}
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", getItemBadge())}>
            {itemTypeLabels[item.itemType] || item.itemType || item.type}
          </Badge>
        </div>
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {item.artist && <span>{item.artist}</span>}
          {item.duration && <span> • {item.duration}</span>}
          {item.releaseYear > 0 && <span> • {item.releaseYear}</span>}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
        {item.hasChildren && (
          <p className="text-xs text-emerald-500 mt-1">
            {item.childCount} items →
          </p>
        )}
      </div>

      {/* Duration for audio items */}
      {isAudio && item.duration && (
        <div className="flex items-center text-xs text-muted-foreground shrink-0">
          <Clock className="h-3 w-3 mr-1" />
          {item.duration}
        </div>
      )}
    </div>
  )
}
