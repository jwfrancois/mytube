'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Star,
  ChevronDown,
  ChevronUp,
  Users,
  Film,
  Tv,
  Music,
  Play,
  Clock,
  ExternalLink,
  Sparkles,
  FolderOpen,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CastPerson {
  id: string | number
  name: string
  role: string
  character?: string
  thumbnail: string
  profilePath?: string | null
}

interface GenreInfo {
  id: number | string
  name: string
}

interface TMDBRecommendation {
  id: number
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  rating: number | null
  releaseDate: string
  genreIds: number[]
}

interface SeasonInfo {
  id: string
  name: string
  indexNumber: number
  episodeCount: number
  overview: string
  thumbnail: string
}

interface EpisodeInfo {
  id: string
  name: string
  indexNumber: number
  parentIndexNumber: number
  overview: string
  duration: string
  runTimeTicks: number | null
  thumbnail: string
  mediaSourceId: string
  hasVideo: boolean
}

interface JellyfinDetailData {
  id: string
  name: string
  overview: string
  type: string
  genres: string[]
  studios: string[]
  communityRating: number | null
  officialRating: string
  productionYear: number | null
  runTimeTicks: number | null
  childCount: number
  people: CastPerson[]
  seasons: SeasonInfo[]
  episodes: EpisodeInfo[]
  imageTags: Record<string, string>
  children?: any[]
}

interface TMDBData {
  tmdbId: number
  title: string
  overview: string
  tagline: string
  cast: CastPerson[]
  genres: GenreInfo[]
  communityRating: number | null
  voteCount: number
  posterPath: string | null
  backdropPath: string | null
  similar: TMDBRecommendation[]
  recommendations: TMDBRecommendation[]
  seasons: any[]
  numberOfSeasons: number
  numberOfEpisodes: number
  firstAirDate: string
  releaseDate: string
  status: string
  productionCompanies: string[]
}

// ─── Star Rating Component ──────────────────────────────────────────────────

function StarRating({ rating, max = 10 }: { rating: number | null; max?: number }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">No rating</span>

  const starCount = 5
  const normalized = (rating / max) * starCount
  const fullStars = Math.floor(normalized)
  const hasHalf = normalized - fullStars >= 0.5

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: starCount }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < fullStars
              ? 'fill-amber-400 text-amber-400'
              : i === fullStars && hasHalf
              ? 'fill-amber-400/50 text-amber-400'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
      <span className="text-sm font-medium ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─── Cast Card ───────────────────────────────────────────────────────────────

function CastCard({ person }: { person: CastPerson }) {
  const initials = person.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px] max-w-[80px] group/cast">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-white/5 group-hover/cast:ring-mythic/30 transition-all">
        {person.thumbnail || person.profilePath ? (
          <img
            src={person.thumbnail || person.profilePath || ''}
            alt={person.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-mythic/20 to-purple-500/20 text-foreground font-semibold text-sm">
            {initials}
          </div>
        )}
      </div>
      <div className="text-center w-full">
        <p className="text-xs font-medium truncate w-full">{person.name}</p>
        {(person.role || person.character) && (
          <p className="text-[10px] text-muted-foreground truncate w-full">
            {person.character || person.role}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Recommendation Card ─────────────────────────────────────────────────────

function RecommendationCard({ item }: { item: TMDBRecommendation }) {
  return (
    <div className="flex-shrink-0 w-36 group cursor-pointer">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
        {item.posterPath ? (
          <img
            src={item.posterPath}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Film className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {item.rating !== null && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            {item.rating.toFixed(1)}
          </div>
        )}
      </div>
      <h4 className="text-xs font-medium mt-2 line-clamp-2 leading-tight">
        {item.title}
      </h4>
      {item.releaseDate && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.releaseDate.split('-')[0]}
        </p>
      )}
    </div>
  )
}

// ─── Episode Card ────────────────────────────────────────────────────────────

function EpisodeCard({ episode, onPlay }: { episode: EpisodeInfo; onPlay: (ep: EpisodeInfo) => void }) {
  return (
    <div
      className="flex gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all duration-200 group/ep border border-transparent hover:border-white/5"
      onClick={() => onPlay(episode)}
    >
      {/* Thumbnail */}
      <div className="relative w-32 aspect-video rounded-md overflow-hidden bg-muted shrink-0">
        {episode.thumbnail ? (
          <img
            src={episode.thumbnail}
            alt={episode.name}
            className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Tv className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep:opacity-100 transition-opacity bg-black/40">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          </div>
        </div>
        {episode.duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded backdrop-blur-sm">
            {episode.duration}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-xs font-bold text-mythic shrink-0 mt-0.5 tabular-nums">
            {episode.indexNumber}
          </span>
          <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover/ep:text-mythic transition-colors">
            {episode.name}
          </h4>
        </div>
        {episode.overview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {episode.overview}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {episode.duration && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {episode.duration}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Collection Movie Card ───────────────────────────────────────────────────

function CollectionMovieCard({ child, onClick }: { child: any; onClick: () => void }) {
  return (
    <div
      className="cursor-pointer group/coll"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted ring-1 ring-white/5 group-hover/coll:ring-mythic/30 transition-all">
        {child.ImageTags?.Primary ? (
          <img
            src={`/api/jellyfin/image/${child.Id}?tag=${child.ImageTags.Primary}`}
            alt={child.Name || 'Movie'}
            className="w-full h-full object-cover group-hover/coll:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-muted to-muted-foreground/20">
            <Film className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover/coll:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover/coll:opacity-100 transition-all scale-90 group-hover/coll:scale-100">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <Play className="h-4 w-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        {/* Rating */}
        {child.CommunityRating && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-amber-400 text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400" />
            {child.CommunityRating.toFixed(1)}
          </div>
        )}
      </div>
      <p className="text-xs font-medium truncate mt-1.5 group-hover/coll:text-mythic transition-colors">{child.Name}</p>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
        {child.ProductionYear && <span>{child.ProductionYear}</span>}
        {child.RunTimeTicks && (
          <>
            <span className="text-muted-foreground/40">•</span>
            <span>{Math.floor(child.RunTimeTicks / 600000000 / 60)}h {Math.floor(child.RunTimeTicks / 600000000) % 60}m</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main MediaDetail Component ──────────────────────────────────────────────

interface MediaDetailProps {
  jellyfinId?: string
  title: string
  type: string
  itemType?: string
}

export function MediaDetail({ jellyfinId, title, type, itemType }: MediaDetailProps) {
  const { setCurrentMedia } = useAppStore()

  // Jellyfin details
  const [jellyfinDetails, setJellyfinDetails] = useState<JellyfinDetailData | null>(null)
  const [jellyfinLoading, setJellyfinLoading] = useState(false)
  const [jellyfinError, setJellyfinError] = useState<string | null>(null)

  // TMDB data
  const [tmdbData, setTmdbData] = useState<TMDBData | null>(null)
  const [tmdbLoading, setTmdbLoading] = useState(false)
  const [tmdbError, setTmdbError] = useState<string | null>(null)

  // UI state
  const [overviewExpanded, setOverviewExpanded] = useState(false)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)

  const isTVShow = type === 'TV_SHOW' || itemType === 'Series'
  const isMusic = type === 'MUSIC'
  const isCollection = type === 'COLLECTION' || itemType === 'BoxSet'

  // Reset selectedSeasonId when the media item changes
  useEffect(() => {
    setSelectedSeasonId(null)
    setOverviewExpanded(false)
  }, [jellyfinId, title])

  // Fetch Jellyfin details
  const fetchJellyfinDetails = useCallback(async () => {
    if (!jellyfinId) return
    setJellyfinLoading(true)
    setJellyfinError(null)
    try {
      const res = await fetch(`/api/jellyfin/details/${jellyfinId}`)
      if (!res.ok) throw new Error('Failed to fetch details')
      const data = await res.json()
      setJellyfinDetails(data)
    } catch (err) {
      console.error('Jellyfin details error:', err)
      setJellyfinError('Failed to load details')
    } finally {
      setJellyfinLoading(false)
    }
  }, [jellyfinId])

  // Fetch episodes for a specific season
  const fetchEpisodes = useCallback(async (seasonId: string) => {
    if (!jellyfinId) return
    try {
      const res = await fetch(`/api/jellyfin/details/${jellyfinId}?seasonId=${seasonId}`)
      if (!res.ok) throw new Error('Failed to fetch episodes')
      const data = await res.json()
      setJellyfinDetails((prev) => prev ? { ...prev, episodes: data.episodes || [] } : data)
    } catch (err) {
      console.error('Episodes fetch error:', err)
    }
  }, [jellyfinId])

  // Fetch TMDB data
  const fetchTmdbData = useCallback(async () => {
    if (!title) return
    setTmdbLoading(true)
    setTmdbError(null)
    try {
      const tmdbType = isTVShow ? 'TV_SHOW' : type === 'MUSIC' ? 'MOVIE' : type
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(title)}&type=${tmdbType}`)
      if (!res.ok) throw new Error('TMDB search failed')
      const data = await res.json()
      setTmdbData(data.results)
    } catch (err) {
      console.error('TMDB error:', err)
      setTmdbError('TMDB data unavailable')
    } finally {
      setTmdbLoading(false)
    }
  }, [title, type, isTVShow])

  // Load Jellyfin details on mount
  useEffect(() => {
    fetchJellyfinDetails()
  }, [fetchJellyfinDetails])

  // Load TMDB data on mount (lazy, don't block)
  useEffect(() => {
    fetchTmdbData()
  }, [fetchTmdbData])

  // When seasons load, auto-select first season
  useEffect(() => {
    if (jellyfinDetails?.seasons?.length && !selectedSeasonId) {
      setSelectedSeasonId(jellyfinDetails.seasons[0].id)
    }
  }, [jellyfinDetails?.seasons, selectedSeasonId])

  // When user changes season, fetch episodes for that season
  const handleSeasonChange = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId)
    fetchEpisodes(seasonId)
  }, [fetchEpisodes])

  // Combine overview from both sources
  const overview = jellyfinDetails?.overview || tmdbData?.overview || ''
  const tagline = tmdbData?.tagline || ''
  const communityRating = jellyfinDetails?.communityRating || tmdbData?.communityRating || null

  // Combine cast
  const cast: CastPerson[] = jellyfinDetails?.people?.length
    ? jellyfinDetails.people.filter((p) => p.type === 'Actor').slice(0, 10)
    : tmdbData?.cast?.slice(0, 10) || []

  // Combine genres
  const genres: GenreInfo[] = jellyfinDetails?.genres?.length
    ? jellyfinDetails.genres.map((g, i) => ({ id: `jf-${i}`, name: g }))
    : tmdbData?.genres || []

  // Recommendations
  const recommendations = tmdbData?.recommendations || []
  const similar = tmdbData?.similar || []
  const allRecommendations = [...recommendations, ...similar].filter(
    (item, index, self) => self.findIndex((t) => t.id === item.id) === index
  ).slice(0, 12)

  // Studios
  const studios = jellyfinDetails?.studios || tmdbData?.productionCompanies || []

  // Handle episode play
  const handlePlayEpisode = useCallback((episode: EpisodeInfo) => {
    const streamParams = new URLSearchParams()
    streamParams.set('mediaType', 'video')
    if (episode.mediaSourceId) {
      streamParams.set('mediaSourceId', episode.mediaSourceId)
    }

    setCurrentMedia({
      id: episode.id,
      title: `S${episode.parentIndexNumber}E${episode.indexNumber} - ${episode.name}`,
      description: episode.overview || '',
      type: 'TV_SHOW',
      genre: '',
      thumbnail: episode.thumbnail || '',
      videoUrl: '',
      duration: episode.duration,
      releaseYear: 0,
      artist: '',
      views: 0,
      channel: 'Jellyfin',
      isJellyfin: true,
      jellyfinId: episode.id,
      mediaSourceId: episode.mediaSourceId,
      itemType: 'Episode',
    })
  }, [setCurrentMedia])

  // Handle collection movie click
  const handleCollectionMovieClick = useCallback((child: any) => {
    setCurrentMedia({
      id: `jf-${child.Id}`,
      title: child.Name || 'Untitled',
      description: child.Overview || '',
      type: 'MOVIE',
      genre: (child.Genres || []).join(', '),
      thumbnail: child.ImageTags?.Primary
        ? `/api/jellyfin/image/${child.Id}?tag=${child.ImageTags.Primary}`
        : '',
      videoUrl: '',
      duration: child.RunTimeTicks
        ? `${Math.floor(child.RunTimeTicks / 600000000 / 60)}h ${Math.floor(child.RunTimeTicks / 600000000) % 60}m`
        : '',
      releaseYear: child.ProductionYear || 0,
      artist: '',
      views: 0,
      channel: '',
      isJellyfin: true,
      jellyfinId: child.Id,
      mediaSourceId: child.MediaSources?.[0]?.Id || '',
      itemType: child.Type,
      hasChildren: false,
      childCount: 0,
      communityRating: child.CommunityRating,
      collectionType: 'boxsets',
    })
  }, [setCurrentMedia])

  return (
    <div className="mt-4 space-y-6">
      {/* ─── Synopsis / Overview ──────────────────────────────────────────── */}
      {jellyfinId && (overview || tagline) && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          {tagline && (
            <p className="text-sm italic text-mythic/80 mb-2">&ldquo;{tagline}&rdquo;</p>
          )}
          {overview && (
            <>
              <p
                className={cn(
                  'text-sm leading-relaxed whitespace-pre-line text-muted-foreground',
                  !overviewExpanded && 'line-clamp-4'
                )}
              >
                {overview}
              </p>
              {overview.length > 200 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs text-mythic hover:text-mythic-foreground"
                  onClick={() => setOverviewExpanded(!overviewExpanded)}
                >
                  {overviewExpanded ? (
                    <>Show less <ChevronUp className="h-3 w-3 ml-1" /></>
                  ) : (
                    <>Show more <ChevronDown className="h-3 w-3 ml-1" /></>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Ratings & Genres ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {communityRating !== null && (
          <div className="flex items-center gap-2">
            <StarRating rating={communityRating} />
            {tmdbData?.voteCount ? (
              <span className="text-xs text-muted-foreground">({tmdbData.voteCount.toLocaleString()} votes)</span>
            ) : null}
          </div>
        )}
        {jellyfinDetails?.officialRating && (
          <Badge variant="outline" className="text-xs bg-white/5 border-white/10">
            {jellyfinDetails.officialRating}
          </Badge>
        )}
      </div>

      {/* Genre badges */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Badge
              key={`genre-${genre.id}`}
              variant="secondary"
              className="text-xs font-normal bg-white/5 hover:bg-white/10 border border-white/5"
            >
              {genre.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Studios */}
      {studios.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Studio:</span>{' '}
          {studios.join(', ')}
        </div>
      )}

      <Separator className="bg-white/5" />

      {/* ─── Cast Section ──────────────────────────────────────────────── */}
      {cast.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Cast</h3>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-2">
              {cast.map((person, index) => (
                <CastCard
                  key={`cast-${person.id}-${index}`}
                  person={person}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Loading skeleton for cast */}
      {(jellyfinLoading || tmdbLoading) && cast.length === 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Cast</h3>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-2.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TV Show: Season & Episode Navigation ────────────────────── */}
      {isTVShow && jellyfinId && (
        <div>
          <Separator className="mb-6 bg-white/5" />

          {/* Season selector */}
          {jellyfinDetails?.seasons && jellyfinDetails.seasons.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <Tv className="h-4 w-4 text-mythic" />
              <h3 className="text-sm font-semibold">Episodes</h3>
              <Select
                value={selectedSeasonId || undefined}
                onValueChange={(val) => handleSeasonChange(val)}
              >
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-xs bg-white/5 border-white/10">
                  <SelectValue placeholder="Select Season" />
                </SelectTrigger>
                <SelectContent>
                  {jellyfinDetails.seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} ({season.episodeCount} episodes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Loading skeleton for episodes */}
          {jellyfinLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="w-32 aspect-video rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Episode list */}
          {!jellyfinLoading && jellyfinDetails?.episodes && jellyfinDetails.episodes.length > 0 && (
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {jellyfinDetails.episodes.map((episode) => (
                <EpisodeCard
                  key={`ep-${episode.id}`}
                  episode={episode}
                  onPlay={handlePlayEpisode}
                />
              ))}
            </div>
          )}

          {!jellyfinLoading && (!jellyfinDetails?.episodes || jellyfinDetails.episodes.length === 0) && jellyfinDetails?.seasons && jellyfinDetails.seasons.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Tv className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No episodes found for this season</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Music: Track Info ─────────────────────────────────────────── */}
      {isMusic && jellyfinDetails && (
        <div>
          <Separator className="mb-6 bg-white/5" />
          <div className="flex items-center gap-2 mb-3">
            <Music className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Track Info</h3>
          </div>
          <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/5">
            {jellyfinDetails.studios.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Label:</span>{' '}
                {jellyfinDetails.studios.join(', ')}
              </p>
            )}
            {jellyfinDetails.genres.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Genre:</span>{' '}
                {jellyfinDetails.genres.join(', ')}
              </p>
            )}
            {jellyfinDetails.productionYear && (
              <p className="text-sm">
                <span className="text-muted-foreground">Year:</span>{' '}
                {jellyfinDetails.productionYear}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Collection (BoxSet) — show movies in the collection ──────── */}
      {isCollection && jellyfinDetails && (
        <div>
          <Separator className="mb-6 bg-white/5" />
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Movies in Collection</h3>
            <Badge variant="secondary" className="text-xs ml-2 bg-mythic/10 text-mythic-foreground">
              {jellyfinDetails.children?.length || 0} films
            </Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {jellyfinDetails.children?.map((child: any) => (
              <CollectionMovieCard
                key={child.Id}
                child={child}
                onClick={() => handleCollectionMovieClick(child)}
              />
            ))}
          </div>
          {(!jellyfinDetails.children || jellyfinDetails.children.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No items in this collection.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TMDB Recommendations ──────────────────────────────────────── */}
      {allRecommendations.length > 0 && (
        <div>
          <Separator className="mb-6 bg-white/5" />
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">You Might Also Like</h3>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-2">
              {allRecommendations.map((rec) => (
                <RecommendationCard
                  key={`rec-${rec.id}`}
                  item={rec}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Loading skeleton for recommendations */}
      {tmdbLoading && (
        <div>
          <Separator className="mb-6 bg-white/5" />
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">You Might Also Like</h3>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36">
                <Skeleton className="aspect-[2/3] rounded-lg w-full shimmer" />
                <Skeleton className="h-3 w-3/4 mt-2" />
                <Skeleton className="h-2.5 w-1/2 mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TMDB attribution */}
      {tmdbData && (
        <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
          <ExternalLink className="h-2.5 w-2.5" />
          Data provided by TMDB
        </div>
      )}
    </div>
  )
}
