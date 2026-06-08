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
  Clapperboard,
  PenTool,
  MonitorPlay,
  Globe,
  Signal,
  HardDrive,
  Cpu,
  Volume2,
  Subtitles,
  Award,
  Link2,
  CalendarDays,
  MapPin,
  Building2,
  Radio,
  UserCircle,
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
  type?: string
}

interface CrewPerson {
  id: string | number
  name: string
  role?: string
  job?: string
  department?: string
  thumbnail: string
  profilePath?: string | null
  type?: string
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
  communityRating?: number | null
}

interface MediaVideoInfo {
  codec: string
  width: number
  height: number
  resolution: string
  aspectRatio: string
  frameRate: number
  bitDepth: number
  videoRange: string
}

interface MediaAudioInfo {
  codec: string
  channels: number
  channelLayout: string
  language: string
  sampleRate: number
  bitRate: number
}

interface MediaInfo {
  container: string
  fileSize: string
  fileSizeBytes: number
  video: MediaVideoInfo | null
  audio: MediaAudioInfo | null
  audioTrackCount: number
  subtitleCount: number
  bitRate: number
}

interface ExternalUrl {
  name: string
  url: string
}

interface PodcastEpisodeInfo {
  id: string
  name: string
  overview: string
  duration: string
  runTimeTicks: number | null
  thumbnail: string
  mediaSourceId: string
  premiereDate: string
  productionYear: number | null
  communityRating: number | null
  indexNumber?: number
  artists?: string[]
}

interface JellyfinDetailData {
  id: string
  name: string
  overview: string
  type: string
  genres: string[]
  studios: string[]
  communityRating: number | null
  criticRating: number | null
  officialRating: string
  productionYear: number | null
  runTimeTicks: number | null
  runtime: string
  cumulativeRunTimeTicks: number | null
  cumulativeRuntime: string
  childCount: number
  people: CastPerson[]
  crew: CrewPerson[]
  seasons: SeasonInfo[]
  episodes: EpisodeInfo[]
  imageTags: Record<string, string>
  children?: any[]
  podcastEpisodes?: PodcastEpisodeInfo[]
  podcastTotalCount?: number
  status: string
  airDays: string[]
  airTime: string
  productionLocations: string[]
  providerIds: { imdb: string | null; tmdb: string | null; tvdb: string | null }
  externalUrls: ExternalUrl[]
  mediaInfo: MediaInfo | null
  totalSeasonCount: number
  totalEpisodeCount?: number
  recursiveItemCount: number
}

interface TMDBNetwork {
  id: number
  name: string
  logoPath: string | null
  originCountry: string
}

interface TMDBProductionCompany {
  id: number
  name: string
  logoPath: string | null
  originCountry: string
}

interface TMDBProductionCountry {
  code: string
  name: string
}

interface TMDBData {
  tmdbId: number
  title: string
  overview: string
  tagline: string
  cast: CastPerson[]
  crew: CrewPerson[]
  directors: CrewPerson[]
  writers: CrewPerson[]
  producers: CrewPerson[]
  creators: CrewPerson[]
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
  productionCompanies: TMDBProductionCompany[]
  productionCountries: TMDBProductionCountry[]
  networks: TMDBNetwork[]
  homepage: string
  imdbId: string
  externalUrls: ExternalUrl[]
  runtime: number
  spokenLanguages: string[]
  type: string
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

// ─── Critic Rating Badge ────────────────────────────────────────────────────

function CriticRatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) return null

  const isFresh = rating >= 60
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
      isFresh ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    )}>
      <Award className="h-3.5 w-3.5" />
      <span>{rating}%</span>
      <span className="text-muted-foreground font-normal">Critic</span>
    </div>
  )
}

// ─── Cast Card ───────────────────────────────────────────────────────────────

function CastCard({ person, showRole = true }: { person: CastPerson | CrewPerson; showRole?: boolean }) {
  const initials = person.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const thumbnail = 'thumbnail' in person ? person.thumbnail : ''
  const profilePath = 'profilePath' in person ? person.profilePath : null
  const role = ('character' in person ? person.character : '') || ('role' in person ? person.role : '') || ('job' in person ? person.job : '')

  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px] max-w-[80px] group/cast">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-white/5 group-hover/cast:ring-mythic/30 transition-all">
        {thumbnail || profilePath ? (
          <img
            src={thumbnail || profilePath || ''}
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
        {showRole && role && (
          <p className="text-[10px] text-muted-foreground truncate w-full">
            {role}
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
          {episode.communityRating && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {episode.communityRating.toFixed(1)}
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
        {child.runtime && (
          <>
            <span className="text-muted-foreground/40">•</span>
            <span>{child.runtime}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Info Row (key-value display) ───────────────────────────────────────────

function PodcastEpisodeCard({ episode, onPlay }: { episode: PodcastEpisodeInfo; onPlay: (ep: PodcastEpisodeInfo) => void }) {
  return (
    <div
      className="flex gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all duration-200 group/pod border border-transparent hover:border-white/5"
      onClick={() => onPlay(episode)}
    >
      {/* Thumbnail */}
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
        {episode.thumbnail ? (
          <img
            src={episode.thumbnail}
            alt={episode.name}
            className="w-full h-full object-cover group-hover/pod:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-emerald-500/10">
            <Radio className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/pod:opacity-100 transition-opacity bg-black/40">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover/pod:text-mythic transition-colors">
          {episode.name}
        </h4>
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
          {episode.premiereDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-2.5 w-2.5" />
              {new Date(episode.premiereDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="h-3.5 w-3.5 text-mythic shrink-0 mt-0.5" />
      <span className="text-xs text-muted-foreground min-w-[80px] shrink-0">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
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
  const { setCurrentMedia, setAudioQueue, setAudioQueueIndex, setIsPlaying, setAudioTrack, setRepeatMode } = useAppStore()

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
  const isPodcast = type === 'PODCAST'

  // Track currently playing audio for highlighting in track list
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null)
  useEffect(() => {
    const unsub = useAppStore.subscribe(
      (state, prevState) => {
        if (state.audioTrack?.jellyfinId !== prevState.audioTrack?.jellyfinId) {
          setCurrentlyPlayingId(state.audioTrack?.jellyfinId ?? null)
        }
      }
    )
    setCurrentlyPlayingId(useAppStore.getState().audioTrack?.jellyfinId ?? null)
    return unsub
  }, [])

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
  const criticRating = jellyfinDetails?.criticRating || null

  // Combine cast
  const cast: CastPerson[] = jellyfinDetails?.people?.length
    ? jellyfinDetails.people.filter((p) => p.type === 'Actor').slice(0, 10)
    : tmdbData?.cast?.slice(0, 10) || []

  // Combine crew - directors, writers from both sources
  const directors: CrewPerson[] = jellyfinDetails?.crew?.filter((p) => p.type === 'Director')?.length
    ? jellyfinDetails.crew.filter((p) => p.type === 'Director')
    : tmdbData?.directors || []

  const writers: CrewPerson[] = jellyfinDetails?.crew?.filter((p) => p.type === 'Writer')?.length
    ? jellyfinDetails.crew.filter((p) => p.type === 'Writer')
    : tmdbData?.writers || []

  const creators: CrewPerson[] = tmdbData?.creators || []

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

  // Studios / Production companies
  const studios = jellyfinDetails?.studios || []
  const productionCompanies = tmdbData?.productionCompanies || []

  // Status
  const status = jellyfinDetails?.status || tmdbData?.status || ''

  // Runtime
  const runtime = jellyfinDetails?.runtime || ''
  const tmdbRuntime = tmdbData?.runtime || 0

  // External URLs - merge from both sources
  const externalUrls: ExternalUrl[] = [
    ...(jellyfinDetails?.externalUrls || []),
    ...(tmdbData?.externalUrls || []),
  ].filter((url, index, self) =>
    self.findIndex((t) => t.name === url.name) === index
  )

  // Add TMDB link
  if (tmdbData?.tmdbId) {
    const tmdbType = isTVShow ? 'tv' : 'movie'
    if (!externalUrls.some(u => u.name === 'TMDB')) {
      externalUrls.push({ name: 'TMDB', url: `https://www.themoviedb.org/${tmdbType}/${tmdbData.tmdbId}` })
    }
  }

  // Homepage
  const homepage = tmdbData?.homepage || ''

  // Networks (TV shows)
  const networks = tmdbData?.networks || []

  // Production countries
  const productionCountries = tmdbData?.productionCountries || []
  const jellyfinLocations = jellyfinDetails?.productionLocations || []

  // Season/Episode info
  const seasonCount = jellyfinDetails?.totalSeasonCount || tmdbData?.numberOfSeasons || jellyfinDetails?.seasons?.length || 0
  const episodeCount = jellyfinDetails?.totalEpisodeCount || tmdbData?.numberOfEpisodes || 0

  // Media info
  const mediaInfo = jellyfinDetails?.mediaInfo

  // Air days
  const airDays = jellyfinDetails?.airDays || []
  const airTime = jellyfinDetails?.airTime || ''

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
      createdAt: '',
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
      duration: child.runtime || '',
      releaseYear: child.ProductionYear || 0,
      artist: '',
      views: 0,
      channel: '',
      createdAt: '',
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

  // Handle music track play from album
  const handlePlayMusicTrack = useCallback((episode: PodcastEpisodeInfo, trackIndex: number) => {
    const albumTracks = jellyfinDetails?.podcastEpisodes || []

    // Build MediaItem objects for all tracks in the album
    const queueItems: import('@/store/useAppStore').MediaItem[] = albumTracks.map((ep, i) => ({
      id: ep.id,
      title: ep.name,
      description: ep.overview || '',
      type: 'MUSIC' as const,
      genre: '',
      thumbnail: ep.thumbnail || (jellyfinDetails?.imageTags?.Primary ? `/api/jellyfin/image/${jellyfinId}?tag=${jellyfinDetails.imageTags.Primary}` : ''),
      videoUrl: '',
      duration: ep.duration,
      releaseYear: ep.productionYear || 0,
      artist: ep.artists?.join(', ') || jellyfinDetails?.studios?.join(', ') || '',
      views: 0,
      channel: 'Jellyfin',
      createdAt: '',
      isJellyfin: true,
      jellyfinId: ep.id,
      mediaSourceId: ep.mediaSourceId,
      itemType: 'Audio',
      parentId: jellyfinId,
      indexNumber: ep.indexNumber ?? (i + 1),
    }))

    // Set the queue with all album tracks
    setAudioQueue(queueItems)
    setAudioQueueIndex(trackIndex)

    // Set repeat mode to 'all' for album playback (continuous play through all tracks)
    setRepeatMode('all')

    // Set current media to the clicked track
    const clickedTrack = queueItems[trackIndex]
    if (clickedTrack) {
      setCurrentMedia(clickedTrack)
      setAudioTrack(clickedTrack)
      setIsPlaying(true)
    }
  }, [jellyfinDetails, jellyfinId, setCurrentMedia, setAudioQueue, setAudioQueueIndex, setIsPlaying, setAudioTrack, setRepeatMode])

  // Handle "Play All" for music album
  const handlePlayAllTracks = useCallback(() => {
    const albumTracks = jellyfinDetails?.podcastEpisodes || []
    if (albumTracks.length === 0) return
    handlePlayMusicTrack(albumTracks[0], 0)
  }, [jellyfinDetails?.podcastEpisodes, handlePlayMusicTrack])

  // Handle podcast episode play
  const handlePlayPodcastEpisode = useCallback((episode: PodcastEpisodeInfo) => {
    const streamParams = new URLSearchParams()
    streamParams.set('mediaType', 'audio')
    if (episode.mediaSourceId) {
      streamParams.set('mediaSourceId', episode.mediaSourceId)
    }

    setCurrentMedia({
      id: episode.id,
      title: episode.name,
      description: episode.overview || '',
      type: 'PODCAST',
      genre: '',
      thumbnail: episode.thumbnail || '',
      videoUrl: '',
      duration: episode.duration,
      releaseYear: episode.productionYear || 0,
      artist: '',
      views: 0,
      channel: 'Jellyfin',
      createdAt: '',
      isJellyfin: true,
      jellyfinId: episode.id,
      mediaSourceId: episode.mediaSourceId,
      itemType: 'Audio',
    })
  }, [setCurrentMedia])

  // ─── Status Badge ───
  const renderStatusBadge = () => {
    if (!status) return null
    const statusConfig: Record<string, { color: string; label: string }> = {
      'Continuing': { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: 'Continuing' },
      'Ended': { color: 'bg-red-500/15 text-red-400 border-red-500/20', label: 'Ended' },
      'Released': { color: 'bg-sky-500/15 text-sky-400 border-sky-500/20', label: 'Released' },
      'In Production': { color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: 'In Production' },
      'Post Production': { color: 'bg-purple-500/15 text-purple-400 border-purple-500/20', label: 'Post Production' },
      'Planned': { color: 'bg-slate-500/15 text-slate-400 border-slate-500/20', label: 'Planned' },
      'Canceled': { color: 'bg-red-500/15 text-red-400 border-red-500/20', label: 'Canceled' },
      'Pilot': { color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', label: 'Pilot' },
    }
    const config = statusConfig[status] || { color: 'bg-white/5 text-muted-foreground border-white/10', label: status }
    return (
      <Badge variant="outline" className={cn('text-xs gap-1', config.color)}>
        <Signal className="h-2.5 w-2.5" />
        {config.label}
      </Badge>
    )
  }

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

      {/* ─── Quick Info Bar: Ratings, Runtime, Status, Year ────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Community Rating */}
        {communityRating !== null && (
          <div className="flex items-center gap-2">
            <StarRating rating={communityRating} />
            {tmdbData?.voteCount ? (
              <span className="text-xs text-muted-foreground">({tmdbData.voteCount.toLocaleString()} votes)</span>
            ) : null}
          </div>
        )}

        {/* Critic Rating */}
        <CriticRatingBadge rating={criticRating} />

        {/* Runtime */}
        {(runtime || tmdbRuntime) && (
          <Badge variant="outline" className="text-xs gap-1 bg-white/5 border-white/10">
            <Clock className="h-3 w-3 text-mythic" />
            {runtime || (tmdbRuntime ? `${tmdbRuntime} min` : '')}
          </Badge>
        )}

        {/* Official Rating (PG, R, etc.) */}
        {jellyfinDetails?.officialRating && (
          <Badge variant="outline" className="text-xs bg-white/5 border-white/10 font-bold">
            {jellyfinDetails.officialRating}
          </Badge>
        )}

        {/* Status */}
        {renderStatusBadge()}

        {/* Production Year */}
        {jellyfinDetails?.productionYear && (
          <Badge variant="outline" className="text-xs bg-white/5 border-white/10 gap-1">
            <CalendarDays className="h-2.5 w-2.5" />
            {jellyfinDetails.productionYear}
          </Badge>
        )}
      </div>

      {/* ─── Genre Badges ──────────────────────────────────────────────────── */}
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

      {/* ─── Season/Episode Summary (TV Shows) ──────────────────────────────── */}
      {isTVShow && (seasonCount > 0 || episodeCount > 0) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {seasonCount > 0 && (
            <span className="flex items-center gap-1">
              <Tv className="h-3 w-3 text-mythic" />
              {seasonCount} {seasonCount === 1 ? 'Season' : 'Seasons'}
            </span>
          )}
          {episodeCount > 0 && (
            <>
              {seasonCount > 0 && <span className="text-muted-foreground/40">•</span>}
              <span className="flex items-center gap-1">
                <Film className="h-3 w-3 text-mythic" />
                {episodeCount} {episodeCount === 1 ? 'Episode' : 'Episodes'}
              </span>
            </>
          )}
          {airDays.length > 0 && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-mythic" />
                {airDays.join(', ')}{airTime ? ` at ${airTime}` : ''}
              </span>
            </>
          )}
        </div>
      )}

      {/* ─── Creators / Showrunners (TV Shows) ───────────────────────────────── */}
      {isTVShow && creators.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Created by:</span>{' '}
          {creators.map((c, i) => (
            <span key={`creator-${c.id}-${i}`}>
              {i > 0 && ', '}
              <span className="text-mythic hover:underline cursor-pointer">{c.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* ─── Networks (TV Shows) ─────────────────────────────────────────────── */}
      {isTVShow && networks.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Network:</span>
          {networks.map((n, i) => (
            <div key={`network-${n.id}-${i}`} className="flex items-center gap-1.5">
              {n.logoPath ? (
                <img src={n.logoPath} alt={n.name} className="h-4 object-contain brightness-200 opacity-70" loading="lazy" />
              ) : (
                <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10">{n.name}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Studios & Production ─────────────────────────────────────────────── */}
      {(studios.length > 0 || productionCompanies.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 text-mythic shrink-0" />
          <span className="font-medium">Studio:</span>
          {studios.length > 0 ? (
            studios.map((s, i) => (
              <span key={`studio-${i}`}>
                {i > 0 && <span className="text-muted-foreground/40">•</span>}
                <span className="ml-1">{s}</span>
              </span>
            ))
          ) : (
            productionCompanies.slice(0, 3).map((c, i) => (
              <span key={`prod-${c.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/40">•</span>}
                {c.logoPath && <img src={c.logoPath} alt={c.name} className="h-3 object-contain brightness-200 opacity-50" loading="lazy" />}
                <span>{c.name}</span>
              </span>
            ))
          )}
        </div>
      )}

      {/* ─── Production Country ──────────────────────────────────────────────── */}
      {(productionCountries.length > 0 || jellyfinLocations.length > 0) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 text-mythic" />
          {productionCountries.length > 0
            ? productionCountries.map((c, i) => (
                <span key={`country-${i}`}>
                  {i > 0 && <span className="text-muted-foreground/40">•</span>}
                  {c.name}
                </span>
              ))
            : jellyfinLocations.map((loc: string, i: number) => (
                <span key={`loc-${i}`}>
                  {i > 0 && <span className="text-muted-foreground/40">•</span>}
                  {loc}
                </span>
              ))
          }
        </div>
      )}

      <Separator className="bg-white/5" />

      {/* ─── Crew: Directors & Writers ─────────────────────────────────────── */}
      {(directors.length > 0 || writers.length > 0) && (
        <div>
          {/* Directors */}
          {directors.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Clapperboard className="h-4 w-4 text-mythic" />
                <h3 className="text-sm font-semibold">Director{directors.length > 1 ? 's' : ''}</h3>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-2">
                  {directors.slice(0, 6).map((person, index) => (
                    <CastCard
                      key={`dir-${person.id}-${index}`}
                      person={person}
                      showRole={false}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Writers */}
          {writers.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <PenTool className="h-4 w-4 text-mythic" />
                <h3 className="text-sm font-semibold">Writer{writers.length > 1 ? 's' : ''}</h3>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-2">
                  {writers.slice(0, 6).map((person, index) => (
                    <CastCard
                      key={`writer-${person.id}-${index}`}
                      person={person}
                      showRole={false}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton for crew */}
      {(jellyfinLoading || tmdbLoading) && directors.length === 0 && writers.length === 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clapperboard className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Crew</h3>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ─── Technical Info Panel ───────────────────────────────────────── */}
      {mediaInfo && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Technical Info</h3>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {/* Video */}
              {mediaInfo.video && (
                <>
                  <InfoRow icon={MonitorPlay} label="Resolution" value={
                    <span className="flex items-center gap-1.5">
                      {mediaInfo.video.resolution}
                      {mediaInfo.video.width > 0 && (
                        <span className="text-muted-foreground">({mediaInfo.video.width}×{mediaInfo.video.height})</span>
                      )}
                    </span>
                  } />
                  <InfoRow icon={Cpu} label="Video Codec" value={
                    <span className="uppercase">{mediaInfo.video.codec}
                      {mediaInfo.video.videoRange && (
                        <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {mediaInfo.video.videoRange}
                        </Badge>
                      )}
                    </span>
                  } />
                  {mediaInfo.video.frameRate > 0 && (
                    <InfoRow icon={Film} label="Frame Rate" value={`${mediaInfo.video.frameRate} fps`} />
                  )}
                  {mediaInfo.video.bitDepth > 0 && (
                    <InfoRow icon={Cpu} label="Bit Depth" value={`${mediaInfo.video.bitDepth}-bit`} />
                  )}
                </>
              )}
              {/* Audio */}
              {mediaInfo.audio && (
                <>
                  <InfoRow icon={Volume2} label="Audio" value={
                    <span>
                      <span className="uppercase">{mediaInfo.audio.codec}</span>
                      {mediaInfo.audio.channels > 0 && (
                        <span className="text-muted-foreground ml-1">
                          {mediaInfo.audio.channels === 1 ? 'Mono' :
                           mediaInfo.audio.channels === 2 ? 'Stereo' :
                           mediaInfo.audio.channels === 6 ? '5.1' :
                           mediaInfo.audio.channels === 8 ? '7.1' :
                           `${mediaInfo.audio.channels}ch`}
                        </span>
                      )}
                    </span>
                  } />
                  {mediaInfo.audio.language && (
                    <InfoRow icon={Globe} label="Language" value={mediaInfo.audio.language.toUpperCase()} />
                  )}
                </>
              )}
              {/* Container */}
              <InfoRow icon={HardDrive} label="Container" value={
                <span className="uppercase">{mediaInfo.container}
                  {mediaInfo.fileSize && <span className="text-muted-foreground ml-1">• {mediaInfo.fileSize}</span>}
                </span>
              } />
              {/* Tracks */}
              {mediaInfo.audioTrackCount > 0 && (
                <InfoRow icon={Volume2} label="Audio Tracks" value={`${mediaInfo.audioTrackCount}`} />
              )}
              {mediaInfo.subtitleCount > 0 && (
                <InfoRow icon={Subtitles} label="Subtitles" value={`${mediaInfo.subtitleCount}`} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton for technical info */}
      {jellyfinLoading && !mediaInfo && jellyfinId && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Technical Info</h3>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      )}

      {/* ─── External Links ────────────────────────────────────────────── */}
      {externalUrls.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">External Links</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {externalUrls.map((url, index) => (
              <a
                key={`ext-${index}`}
                href={url.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-mythic/20 text-xs transition-colors"
              >
                {url.name === 'IMDb' && <Film className="h-3 w-3 text-amber-400" />}
                {url.name === 'TMDB' && <Tv className="h-3 w-3 text-emerald-400" />}
                {url.name === 'TheTVDB' && <Tv className="h-3 w-3 text-sky-400" />}
                {!['IMDb', 'TMDB', 'TheTVDB'].includes(url.name) && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                {url.name}
              </a>
            ))}
            {homepage && (
              <a
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-mythic/20 text-xs transition-colors"
              >
                <Globe className="h-3 w-3 text-mythic" />
                Official Site
              </a>
            )}
          </div>
        </div>
      )}

      <Separator className="bg-white/5" />

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
                value={selectedSeasonId || ''}
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
              {jellyfinDetails.episodes.map((episode, index) => (
                <EpisodeCard
                  key={`ep-${episode.id}-${index}`}
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
            {jellyfinDetails.runtime && (
              <p className="text-sm">
                <span className="text-muted-foreground">Duration:</span>{' '}
                {jellyfinDetails.runtime}
              </p>
            )}
            {mediaInfo && (
              <>
                <Separator className="bg-white/5 my-2" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {mediaInfo.container && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Format:</span>{' '}
                      <span className="uppercase">{mediaInfo.container}</span>
                    </p>
                  )}
                  {mediaInfo.audio && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Audio:</span>{' '}
                      <span className="uppercase">{mediaInfo.audio.codec}</span>
                      {mediaInfo.audio.bitRate > 0 && (
                        <span className="text-muted-foreground ml-1">
                          {Math.round(mediaInfo.audio.bitRate / 1000)} kbps
                        </span>
                      )}
                    </p>
                  )}
                  {mediaInfo.fileSize && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Size:</span>{' '}
                      {mediaInfo.fileSize}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Music Album: Track List ──────────────────────────────────────── */}
      {isMusic && jellyfinDetails?.podcastEpisodes && jellyfinDetails.podcastEpisodes.length > 0 && (
        <div>
          <Separator className="mb-6 bg-white/5" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-mythic" />
              <h3 className="text-sm font-semibold">Tracks</h3>
              <Badge variant="secondary" className="text-xs ml-2 bg-mythic/10 text-mythic-foreground">
                {jellyfinDetails.podcastEpisodes.length} track{jellyfinDetails.podcastEpisodes.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handlePlayAllTracks}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play All
            </Button>
          </div>

          {/* Loading skeleton for track list */}
          {jellyfinLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-6 h-4" />
                  <Skeleton className="flex-1 h-4" />
                  <Skeleton className="w-12 h-4" />
                </div>
              ))}
            </div>
          )}

          {/* Track list */}
          {!jellyfinLoading && (
            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              {jellyfinDetails.podcastEpisodes.map((episode, index) => {
                const trackNum = episode.indexNumber ?? (index + 1)
                const isCurrentlyPlaying = currentlyPlayingId === episode.id
                return (
                  <div
                    key={`track-${episode.id}-${index}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 group/track',
                      'hover:bg-white/5 border-b border-white/5 last:border-b-0',
                      isCurrentlyPlaying && 'bg-mythic/10 border-l-2 border-l-mythic'
                    )}
                    onClick={() => handlePlayMusicTrack(episode, index)}
                  >
                    {/* Track number / Play icon on hover */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      <span className={cn(
                        'text-xs tabular-nums group-hover/track:hidden',
                        isCurrentlyPlaying ? 'text-mythic font-bold' : 'text-muted-foreground'
                      )}>
                        {trackNum}
                      </span>
                      <Play className={cn(
                        'h-3.5 w-3.5 hidden group-hover/track:block fill-current',
                        isCurrentlyPlaying ? 'text-mythic' : 'text-foreground'
                      )} />
                    </div>

                    {/* Track title + artist */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm truncate leading-tight',
                        isCurrentlyPlaying ? 'text-mythic font-medium' : 'group-hover/track:text-mythic transition-colors'
                      )}>
                        {episode.name}
                      </p>
                      {(episode.artists && episode.artists.length > 0) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {episode.artists.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Duration */}
                    {episode.duration && (
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {episode.duration}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
            {jellyfinDetails.cumulativeRuntime && (
              <Badge variant="outline" className="text-xs gap-1 bg-white/5 border-white/10">
                <Clock className="h-2.5 w-2.5 text-mythic" />
                Total: {jellyfinDetails.cumulativeRuntime}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {jellyfinDetails.children?.map((child: any, index: number) => (
              <CollectionMovieCard
                key={`child-${child.Id}-${index}`}
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

      {/* ─── Podcast: Episode List ─────────────────────────────────────────── */}
      {isPodcast && jellyfinId && (
        <div>
          <Separator className="mb-6 bg-white/5" />

          <div className="flex items-center gap-2 mb-4">
            <Radio className="h-4 w-4 text-mythic" />
            <h3 className="text-sm font-semibold">Episodes</h3>
            {jellyfinDetails?.podcastTotalCount != null && jellyfinDetails.podcastTotalCount > 0 && (
              <Badge variant="secondary" className="text-xs ml-2 bg-mythic/10 text-mythic-foreground">
                {jellyfinDetails.podcastTotalCount.toLocaleString()} episodes
              </Badge>
            )}
            {jellyfinDetails?.childCount != null && jellyfinDetails.childCount > 0 && !jellyfinDetails?.podcastTotalCount && (
              <Badge variant="secondary" className="text-xs ml-2 bg-mythic/10 text-mythic-foreground">
                {jellyfinDetails.childCount.toLocaleString()} episodes
              </Badge>
            )}
          </div>

          {/* Loading skeleton for podcast episodes */}
          {jellyfinLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
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
          {!jellyfinLoading && jellyfinDetails?.podcastEpisodes && jellyfinDetails.podcastEpisodes.length > 0 && (
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {jellyfinDetails.podcastEpisodes.map((episode, index) => (
                <PodcastEpisodeCard
                  key={`pod-ep-${episode.id}-${index}`}
                  episode={episode}
                  onPlay={handlePlayPodcastEpisode}
                />
              ))}
            </div>
          )}

          {!jellyfinLoading && (!jellyfinDetails?.podcastEpisodes || jellyfinDetails.podcastEpisodes.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No episodes found</p>
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
