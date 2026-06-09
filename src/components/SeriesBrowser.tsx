'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaCard } from '@/components/MediaCard'
import {
  ArrowLeft,
  Play,
  Star,
  Clock,
  Disc,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Server,
  Tv,
  Library,
  Music,
  Headphones,
  Mic,
  ListMusic,
  Shuffle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SeriesBrowserProps {
  series: MediaItem
  onBack: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(duration?: string, durationTicks?: number): string | null {
  if (duration) return duration
  if (!durationTicks) return null
  const totalMinutes = Math.round(durationTicks / 600000000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function getGenres(item: MediaItem): string[] {
  if (Array.isArray(item.tags) && item.tags.length > 0) return item.tags.slice(0, 3)
  if (typeof item.genre === 'string') {
    return item.genre
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 3)
  }
  return []
}

function getTypeBadge(item: MediaItem): { label: string; color: string; icon: React.ElementType } {
  const itemType = item.itemType || item.type
  switch (itemType) {
    case 'Series':
    case 'TV_SHOW':
      return { label: 'TV Series', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25', icon: Tv }
    case 'PODCAST':
      return { label: 'Podcast', color: 'bg-amber-500/15 text-amber-500 border-amber-500/25', icon: Mic }
    case 'BoxSet':
    case 'COLLECTION':
      return { label: 'Collection', color: 'bg-orange-500/15 text-orange-500 border-orange-500/25', icon: Library }
    case 'MusicAlbum':
    case 'MUSIC':
      return { label: 'Album', color: 'bg-purple-500/15 text-purple-500 border-purple-500/25', icon: Disc }
    case 'AudioBook':
    case 'AUDIOBOOK':
      return { label: 'Audiobook', color: 'bg-amber-500/15 text-amber-500 border-amber-500/25', icon: BookOpen }
    default:
      return { label: 'Media', color: 'bg-gray-500/15 text-gray-500 border-gray-500/25', icon: Play }
  }
}

function isSeriesType(item: MediaItem): boolean {
  const t = item.itemType || item.type
  return t === 'Series' || t === 'TV_SHOW' || t === 'PODCAST'
}

function isCollectionType(item: MediaItem): boolean {
  const t = item.itemType || item.type
  return t === 'BoxSet' || t === 'COLLECTION'
}

function isAlbumType(item: MediaItem): boolean {
  const t = item.itemType || item.type
  return t === 'MusicAlbum' || t === 'MUSIC' || t === 'AudioBook' || t === 'AUDIOBOOK'
}

function isAudioBookType(item: MediaItem): boolean {
  const t = item.itemType || item.type
  return t === 'AudioBook' || t === 'AUDIOBOOK'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function HeaderSection({
  series,
  onBack,
  descriptionExpanded,
  onToggleDescription,
}: {
  series: MediaItem
  onBack: () => void
  descriptionExpanded: boolean
  onToggleDescription: () => void
}) {
  const { jellyfinConnected } = useAppStore()
  const badge = getTypeBadge(series)
  const TypeIcon = badge.icon
  const genres = getGenres(series)
  const durationLabel = formatDuration(series.duration, series.durationTicks)

  return (
    <div className="relative">
      {/* Backdrop gradient */}
      {series.thumbnail && (
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-b-2xl">
          <img
            src={series.thumbnail}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-110 opacity-15"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="relative p-6 pb-4 space-y-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="group/btn -ml-2 gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover/btn:-translate-x-0.5" />
          Back
        </Button>

        {/* Title row */}
        <div className="flex items-start gap-4">
          {/* Album art for music/audiobooks */}
          {isAlbumType(series) && (
            <div className="hidden sm:block shrink-0">
              <div className="w-28 h-28 rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/10">
                {series.thumbnail ? (
                  <img
                    src={series.thumbnail}
                    alt={series.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-purple-900/50 flex items-center justify-center">
                    {isAudioBookType(series) ? (
                      <BookOpen className="h-10 w-10 text-purple-300/50" />
                    ) : (
                      <Disc className="h-10 w-10 text-purple-300/50" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{series.title}</h1>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-xs gap-1.5 font-semibold', badge.color)}>
                <TypeIcon className="h-3 w-3" />
                {badge.label}
              </Badge>
              {series.communityRating != null && series.communityRating > 0 && (
                <Badge variant="outline" className="text-xs gap-1 font-semibold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {series.communityRating.toFixed(1)}
                </Badge>
              )}
              {series.releaseYear > 0 && (
                <Badge variant="outline" className="text-xs font-medium">{series.releaseYear}</Badge>
              )}
              {durationLabel && (
                <Badge variant="outline" className="text-xs gap-1 font-medium">
                  <Clock className="h-3 w-3" />
                  {durationLabel}
                </Badge>
              )}
              {series.isJellyfin && jellyfinConnected && (
                <Badge variant="outline" className="text-xs gap-1 font-semibold bg-emerald-500/15 text-emerald-500 border-emerald-500/25">
                  <Server className="h-3 w-3" />
                  NAS
                </Badge>
              )}
            </div>

            {/* Genre tags */}
            {genres.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted/80 text-muted-foreground border border-border/50"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Additional metadata */}
            {(series.officialRating || series.studios?.length || series.childCount > 0) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {series.officialRating && (
                  <span className="px-1.5 py-0.5 rounded border border-border/50 font-medium">{series.officialRating}</span>
                )}
                {series.studios && series.studios.length > 0 && (
                  <span>{series.studios.slice(0, 2).join(', ')}</span>
                )}
                {isSeriesType(series) && series.childCount > 0 && (
                  <span>{series.childCount} season{series.childCount > 1 ? 's' : ''}</span>
                )}
                {isCollectionType(series) && series.childCount > 0 && (
                  <span>{series.childCount} item{series.childCount > 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {series.description && (
          <div className="space-y-1">
            <p className={cn('text-sm text-muted-foreground leading-relaxed transition-all duration-300', !descriptionExpanded && 'line-clamp-3')}>
              {series.description}
            </p>
            {series.description.length > 150 && (
              <button
                onClick={onToggleDescription}
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-0.5 transition-colors"
              >
                {descriptionExpanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Read more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Season Tabs ────────────────────────────────────────────────────────────────

function SeasonTabs() {
  const { seriesSeasons, activeSeason, setActiveSeason, setSeriesEpisodes, setSeriesLoading } = useAppStore()

  const handleSeasonChange = useCallback(
    async (seasonIndex: number) => {
      const season = seriesSeasons[seasonIndex]
      if (!season) return

      setActiveSeason(seasonIndex + 1)
      setSeriesLoading(true)
      setSeriesEpisodes([])

      try {
        const res = await fetch(`/api/jellyfin/series?seasonId=${season.id}`)
        const data = await res.json()
        setSeriesEpisodes(data.episodes || [])
      } catch (err) {
        console.error('Failed to fetch episodes:', err)
        setSeriesEpisodes([])
      } finally {
        setSeriesLoading(false)
      }
    },
    [seriesSeasons, setActiveSeason, setSeriesEpisodes, setSeriesLoading]
  )

  if (seriesSeasons.length === 0) return null

  return (
    <div className="px-6">
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        {seriesSeasons.map((season, index) => {
          const isActive = activeSeason === index + 1
          return (
            <button
              key={season.id}
              onClick={() => handleSeasonChange(index)}
              className={cn(
                'relative shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200',
                'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'text-primary bg-muted/80' : 'text-muted-foreground'
              )}
            >
              <span>{season.name || `Season ${season.indexNumber}`}</span>
              {season.episodeCount > 0 && (
                <span
                  className={cn(
                    'ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {season.episodeCount}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          )
        })}
      </div>
      <Separator />
    </div>
  )
}

// ── Episode Card ───────────────────────────────────────────────────────────────

function EpisodeCard({ episode, isCurrentlyPlaying }: { episode: MediaItem; isCurrentlyPlaying: boolean }) {
  const { setCurrentMedia } = useAppStore()
  const [imageError, setImageError] = useState(false)
  const durationLabel = formatDuration(episode.duration, episode.durationTicks)
  const seasonNum = episode.seasonNumber ?? episode.parentIndexNumber
  const episodeNum = episode.episodeNumber ?? episode.indexNumber

  return (
    <div
      className={cn(
        'group cursor-pointer rounded-xl overflow-hidden transition-all duration-300',
        'hover:ring-2 hover:ring-primary/30 hover:shadow-xl',
        'bg-card border border-border/40',
        isCurrentlyPlaying && 'ring-2 ring-primary/50 bg-primary/5'
      )}
      onClick={() => setCurrentMedia(episode)}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {episode.thumbnail && !imageError ? (
          <img
            src={episode.thumbnail}
            alt={episode.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted-foreground/10">
            <Tv className="h-8 w-8 text-muted-foreground/25" />
          </div>
        )}
        {episodeNum != null && (
          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
            {episodeNum}
          </div>
        )}
        {seasonNum != null && episodeNum != null && (
          <div className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            S{seasonNum}E{episodeNum}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 ease-out">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30 shadow-lg shadow-black/20">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        {durationLabel && (
          <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
            {durationLabel}
          </div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors duration-200">
          {episode.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {seasonNum != null && episodeNum != null && (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">S{seasonNum}E{episodeNum}</span>
          )}
          {durationLabel && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{durationLabel}</span>
            </>
          )}
          {episode.communityRating != null && episode.communityRating > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />{episode.communityRating.toFixed(1)}</span>
            </>
          )}
        </div>
        {episode.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">{episode.description}</p>
        )}
      </div>
    </div>
  )
}

// ── Episode Grid ───────────────────────────────────────────────────────────────

function EpisodeGrid() {
  const { seriesEpisodes, seriesLoading, currentMedia } = useAppStore()

  if (seriesLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl overflow-hidden border border-border/40">
              <Skeleton className="aspect-video w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (seriesEpisodes.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Tv className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">No episodes found</p>
        <p className="text-xs mt-1">This season may be empty</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {seriesEpisodes.map((episode) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            isCurrentlyPlaying={currentMedia?.id === episode.id}
          />
        ))}
      </div>
    </div>
  )
}

// ── Collection Grid ────────────────────────────────────────────────────────────

function CollectionGrid({ items, loading }: { items: MediaItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Library className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">No items in this collection</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// ── Album Track List ───────────────────────────────────────────────────────────

function AlbumTrackList({ tracks, loading, parentItem }: { tracks: MediaItem[]; loading: boolean; parentItem: MediaItem }) {
  const { setCurrentMedia, currentMedia, setPlaybackQueue } = useAppStore()
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null)

  const isAudioBook = isAudioBookType(parentItem)
  const queueTypeLabel = isAudioBook ? 'Audiobook' : parentItem.type === 'PODCAST' ? 'Podcast' : 'Album'

  // Play all tracks starting from a specific index
  const playAllFromIndex = useCallback((startIndex: number) => {
    if (tracks.length === 0) return

    // Set up the playback queue with all tracks
    setPlaybackQueue({
      items: tracks,
      currentIndex: startIndex,
      parentItem,
      queueType: queueTypeLabel,
      repeat: 'none',
      shuffle: false,
    })

    // Start playing the selected track
    setCurrentMedia(tracks[startIndex])
  }, [tracks, parentItem, queueTypeLabel, setCurrentMedia, setPlaybackQueue])

  // Shuffle play
  const shufflePlay = useCallback(() => {
    if (tracks.length === 0) return

    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
    setPlaybackQueue({
      items: shuffled,
      currentIndex: 0,
      parentItem,
      queueType: `${queueTypeLabel} (Shuffle)`,
      repeat: 'none',
      shuffle: true,
    })
    setCurrentMedia(shuffled[0])
  }, [tracks, parentItem, queueTypeLabel, setCurrentMedia, setPlaybackQueue])

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-16 text-muted-foreground">
        {isAudioBook ? (
          <BookOpen className="h-12 w-12 mb-3 opacity-20" />
        ) : (
          <Music className="h-12 w-12 mb-3 opacity-20" />
        )}
        <p className="text-sm font-medium">No tracks found</p>
      </div>
    )
  }

  // Calculate total duration
  const totalDurationTicks = tracks.reduce((sum, t) => sum + (t.durationTicks || 0), 0)
  const totalDuration = formatDuration(undefined, totalDurationTicks)

  return (
    <div className="p-6">
      {/* Play controls */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          className="gap-2"
          onClick={() => playAllFromIndex(0)}
        >
          <Play className="h-4 w-4 fill-current" />
          Play All
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={shufflePlay}
        >
          <Shuffle className="h-4 w-4" />
          Shuffle
        </Button>
        {totalDuration && (
          <span className="text-xs text-muted-foreground ml-auto">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {totalDuration}
          </span>
        )}
      </div>

      {/* Track list */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {tracks.map((track, index) => {
          const isActive = currentMedia?.id === track.id
          const isHovered = hoveredTrack === track.id
          const trackNum = track.indexNumber ?? track.episodeNumber ?? index + 1
          const durationLabel = formatDuration(track.duration, track.durationTicks)

          return (
            <div
              key={track.id}
              className={cn(
                'group flex items-center gap-4 px-4 py-3 transition-all duration-200 cursor-pointer',
                'hover:bg-muted/60',
                isActive && 'bg-primary/8 hover:bg-primary/12',
                index < tracks.length - 1 && 'border-b border-border/30'
              )}
              onClick={() => playAllFromIndex(index)}
              onMouseEnter={() => setHoveredTrack(track.id)}
              onMouseLeave={() => setHoveredTrack(null)}
            >
              {/* Track number / Play indicator */}
              <div className="w-8 shrink-0 flex items-center justify-center">
                {(isHovered || isActive) ? (
                  <Play
                    className={cn(
                      'h-4 w-4 transition-all duration-200',
                      isActive ? 'text-primary fill-primary' : 'text-foreground fill-foreground'
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {trackNum}
                  </span>
                )}
              </div>

              {/* Album thumbnail for track */}
              {track.thumbnail && (
                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden shadow-sm">
                  <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate transition-colors', isActive ? 'text-primary' : 'group-hover:text-primary')}>
                  {track.title}
                </p>
                {track.artist && track.artist !== track.albumArtist && (
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                )}
              </div>

              {/* Duration */}
              {durationLabel && (
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{durationLabel}</span>
              )}

              {/* Now playing indicator */}
              {isActive && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse [animation-delay:0ms]" />
                  <span className="w-0.5 h-4 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                  <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SeriesBrowser({ series, onBack }: SeriesBrowserProps) {
  const {
    seriesSeasons,
    setSeriesSeasons,
    seriesEpisodes,
    setSeriesEpisodes,
    activeSeason,
    setActiveSeason,
    seriesLoading,
    setSeriesLoading,
    currentMedia,
    jellyfinConnected,
  } = useAppStore()

  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [collectionItems, setCollectionItems] = useState<MediaItem[]>([])
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [albumTracks, setAlbumTracks] = useState<MediaItem[]>([])
  const [albumLoading, setAlbumLoading] = useState(false)

  const jellyfinId = series.jellyfinId || series.id.replace('jf-', '')

  // Fetch series seasons and first season's episodes
  const fetchSeriesData = useCallback(async () => {
    setSeriesLoading(true)
    setSeriesSeasons([])
    setSeriesEpisodes([])

    try {
      const res = await fetch(`/api/jellyfin/series?seriesId=${jellyfinId}`)
      const data = await res.json()
      const seasons = data.seasons || []
      const mappedSeasons = seasons.map((s: MediaItem) => ({
        id: s.jellyfinId || s.id,
        name: s.title || s.seasonName || `Season ${s.indexNumber || s.parentIndexNumber}`,
        indexNumber: s.indexNumber || s.parentIndexNumber || 1,
        episodeCount: s.childCount || 0,
      }))
      setSeriesSeasons(mappedSeasons)

      if (mappedSeasons.length > 0) {
        setActiveSeason(1)
        try {
          const epRes = await fetch(`/api/jellyfin/series?seasonId=${mappedSeasons[0].id}`)
          const epData = await epRes.json()
          setSeriesEpisodes(epData.episodes || [])
        } catch (err) {
          console.error('Failed to fetch episodes:', err)
        }
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err)
    } finally {
      setSeriesLoading(false)
    }
  }, [jellyfinId, setSeriesLoading, setSeriesSeasons, setSeriesEpisodes, setActiveSeason])

  const fetchCollectionData = useCallback(async () => {
    setCollectionLoading(true)
    try {
      const res = await fetch(`/api/jellyfin/collection?collectionId=${jellyfinId}`)
      const data = await res.json()
      setCollectionItems(data.items || [])
    } catch (err) {
      console.error('Failed to fetch collection items:', err)
    } finally {
      setCollectionLoading(false)
    }
  }, [jellyfinId])

  const fetchAlbumData = useCallback(async () => {
    setAlbumLoading(true)
    try {
      const res = await fetch(`/api/jellyfin/items?parentId=${jellyfinId}`)
      const data = await res.json()
      setAlbumTracks(data.items || [])
    } catch (err) {
      console.error('Failed to fetch album tracks:', err)
    } finally {
      setAlbumLoading(false)
    }
  }, [jellyfinId])

  useEffect(() => {
    if (isSeriesType(series) && jellyfinId) {
      fetchSeriesData()
    } else if (isCollectionType(series) && jellyfinId) {
      fetchCollectionData()
    } else if (isAlbumType(series) && jellyfinId) {
      fetchAlbumData()
    }

    return () => {
      setSeriesSeasons([])
      setSeriesEpisodes([])
      setActiveSeason(1)
    }
  }, [series, jellyfinId, fetchSeriesData, fetchCollectionData, fetchAlbumData, setSeriesSeasons, setSeriesEpisodes, setActiveSeason])

  return (
    <div className="space-y-0">
      <HeaderSection
        series={series}
        onBack={onBack}
        descriptionExpanded={descriptionExpanded}
        onToggleDescription={() => setDescriptionExpanded((prev) => !prev)}
      />

      {isSeriesType(series) && (
        <>
          <SeasonTabs />
          <EpisodeGrid />
        </>
      )}

      {isCollectionType(series) && (
        <CollectionGrid items={collectionItems} loading={collectionLoading} />
      )}

      {isAlbumType(series) && (
        <AlbumTrackList tracks={albumTracks} loading={albumLoading} parentItem={series} />
      )}
    </div>
  )
}
