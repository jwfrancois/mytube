'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore, type MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  X,
  Play,
  Star,
  Clock,
  Calendar,
  Server,
  Film,
  Tv,
  Music,
  Headphones,
  BookOpen,
  Library,
  Mic,
  Globe,
  Award,
  Lightbulb,
  TrendingUp,
  Users,
  Building2,
  Clapperboard,
  Info,
  ExternalLink,
  Loader2,
  ChevronUp,
  PenTool,
  Volume2,
  Subtitles,
  Monitor,
  HardDrive,
  Sparkles,
  Disc,
  Disc3,
  GitBranch,
  Handshake,
  Zap,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnrichedMetadata {
  synopsis?: string
  criticsConsensus?: string
  audienceScore?: number
  criticScore?: number
  awards?: string[]
  trivia?: string[]
  similarTitles?: string[]
  streamingOn?: string[]
  imdbRating?: number
  rottenTomatoes?: string
  metacritic?: number
  runtime?: string
  budget?: string
  boxOffice?: string
  label?: string
  producer?: string[]
  network?: string
  seasons?: number
  status?: string
  narrator?: string
  publisher?: string
}

interface PersonInfo {
  id: string
  name: string
  role: string
  type: string
  primaryImageTag: string
  imageUrl: string
  sortOrder: number
}

interface StudioInfo {
  id: string
  name: string
  imageUrl: string
}

interface MediaStream {
  type: string
  codec: string
  language: string
  channels: number
  sampleRate: number
  bitRate: number
  width: number
  height: number
  aspectRatio: string
  frameRate: number
  bitDepth: number
  title: string
  displayTitle: string
}

interface MediaSourceInfo {
  id: string
  name: string
  container: string
  size: number
  bitrate: number
  mediaStreams: MediaStream[]
}

interface ItemMetadata {
  overview: string
  genres: string[]
  studios: StudioInfo[]
  communityRating: number | null
  officialRating: string
  productionLocations: string[]
  premiereDate: string
  runTimeTicks: number | null
  productionYear: number | null
  tags: string[]
  mediaSources: MediaSourceInfo[]
}

interface PeopleData {
  people: PersonInfo[]
  itemMetadata: ItemMetadata
}

interface FilmographyItem {
  id: string
  jellyfinId: string
  title: string
  type: string
  year: number
  overview: string
  genres: string[]
  communityRating: number | null
  officialRating: string
  runTimeTicks: number | null
  thumbnail: string
  studios: string[]
}

interface PersonDetails {
  id: string
  name: string
  overview: string
  imageUrl: string
  birthDate: string
  birthYear: number
  productionLocations: string[]
}

interface FilmographyData {
  items: FilmographyItem[]
  person: PersonDetails | null
  total: number
}

interface SimilarItem {
  id: string
  jellyfinId: string
  title: string
  type: string
  year: number
  overview: string
  genres: string[]
  communityRating: number | null
  officialRating: string
  runTimeTicks: number | null
  thumbnail: string
  studios: string[]
  isJellyfin: boolean
  hasChildren: boolean
  childCount: number
  itemType: string
}

interface ArtistData {
  id: string
  name: string
  overview: string
  genres: string[]
  birthDate: string
  birthYear: number | null
  endDate: string
  imageUrl: string
  communityRating: number | null
  productionLocations: string[]
}

interface AlbumData {
  id: string
  jellyfinId: string
  name: string
  year: number | null
  overview: string
  genres: string[]
  communityRating: number | null
  premiereDate: string
  imageUrl: string
  albumArtist: string
}

interface CollaborationData {
  name: string
  id: string
}

interface CareerHighlight {
  year: number
  title: string
  type: string
}

interface ArtistInfoData {
  artist: ArtistData
  albums: AlbumData[]
  collaborations: CollaborationData[]
  careerHighlights: CareerHighlight[]
  totalAlbums: number
}

interface MediaDetailPanelProps {
  item: MediaItem
  onClose: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(duration?: string, durationTicks?: number): string | null {
  if (duration) return duration
  if (!durationTicks) return null
  const totalMinutes = Math.round(durationTicks / 600000000)
  if (totalMinutes < 60) return `${totalMinutes}min`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function getGenres(item: MediaItem, metadataGenres?: string[]): string[] {
  if (metadataGenres && metadataGenres.length > 0) return metadataGenres.slice(0, 8)
  if (Array.isArray(item.tags) && item.tags.length > 0) return item.tags.slice(0, 8)
  if (typeof item.genre === 'string') {
    return item.genre.split(',').map((g: string) => g.trim()).filter(Boolean).slice(0, 8)
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
      return { label: 'Album', color: 'bg-purple-500/15 text-purple-500 border-purple-500/25', icon: Music }
    case 'AudioBook':
    case 'AUDIOBOOK':
      return { label: 'Audiobook', color: 'bg-amber-500/15 text-amber-500 border-amber-500/25', icon: BookOpen }
    case 'Episode':
      return { label: 'Episode', color: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/25', icon: Tv }
    case 'Book':
    case 'BOOK':
      return { label: 'Book', color: 'bg-blue-500/15 text-blue-500 border-blue-500/25', icon: BookOpen }
    default:
      return { label: 'Movie', color: 'bg-red-500/15 text-red-500 border-red-500/25', icon: Film }
  }
}

function getResolutionLabel(width?: number, height?: number): string | null {
  if (!width && !height) return null
  if ((height || 0) >= 2160 || (width || 0) >= 3840) return '4K'
  if ((height || 0) >= 1080 || (width || 0) >= 1920) return 'HD'
  if ((height || 0) >= 720) return '720p'
  return null
}

function getAudioLabel(channels?: number): string | null {
  if (!channels) return null
  if (channels >= 6) return '5.1 Surround'
  if (channels >= 2) return 'Stereo'
  return 'Mono'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatBitrate(bitrate: number): string {
  if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`
  if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} kbps`
  return `${bitrate} bps`
}

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    eng: 'English', en: 'English', fre: 'French', fr: 'French',
    spa: 'Spanish', es: 'Spanish', ger: 'German', de: 'German',
    ita: 'Italian', it: 'Italian', por: 'Portuguese', pt: 'Portuguese',
    jpn: 'Japanese', ja: 'Japanese', kor: 'Korean', ko: 'Korean',
    chi: 'Chinese', zh: 'Chinese', rus: 'Russian', ru: 'Russian',
    ara: 'Arabic', ar: 'Arabic', hin: 'Hindi', hi: 'Hindi',
    tha: 'Thai', th: 'Thai', pol: 'Polish', pl: 'Polish',
    dut: 'Dutch', nl: 'Dutch', swe: 'Swedish', sv: 'Swedish',
    nor: 'Norwegian', no: 'Norwegian', dan: 'Danish', da: 'Danish',
    fin: 'Finnish', fi: 'Finnish', tur: 'Turkish', tr: 'Turkish',
    heb: 'Hebrew', he: 'Hebrew', hun: 'Hungarian', hu: 'Hungarian',
    cze: 'Czech', cs: 'Czech', gre: 'Greek', el: 'Greek',
    rum: 'Romanian', ro: 'Romanian', ukr: 'Ukrainian', uk: 'Ukrainian',
  }
  return map[code?.toLowerCase()] || code
}

// Generate a colorful gradient based on name hash for fallback avatars
const GRADIENT_PAIRS = [
  ['from-rose-400 to-pink-600', 'text-white'],
  ['from-amber-400 to-orange-600', 'text-white'],
  ['from-emerald-400 to-teal-600', 'text-white'],
  ['from-cyan-400 to-blue-600', 'text-white'],
  ['from-violet-400 to-purple-600', 'text-white'],
  ['from-fuchsia-400 to-pink-600', 'text-white'],
  ['from-lime-400 to-green-600', 'text-gray-900'],
  ['from-sky-400 to-indigo-600', 'text-white'],
  ['from-red-400 to-rose-600', 'text-white'],
  ['from-yellow-400 to-amber-600', 'text-gray-900'],
  ['from-teal-400 to-cyan-600', 'text-white'],
  ['from-purple-400 to-violet-600', 'text-white'],
]

function getGradientForName(name: string): { gradient: string; textColor: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const index = Math.abs(hash) % GRADIENT_PAIRS.length
  return { gradient: GRADIENT_PAIRS[index][0], textColor: GRADIENT_PAIRS[index][1] }
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}


// ── Score Circle ────────────────────────────────────────────────────────────────

function ScoreCircle({ score, label, color }: { score: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (score / 100) * circumference
  const scoreColor = score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className={color} strokeLinecap="round" />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-bold', scoreColor)}>
          {score}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

// ── Person Card ────────────────────────────────────────────────────────────────

function PersonCard({
  person,
  isSelected,
  onClick,
}: {
  person: PersonInfo
  isSelected: boolean
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const { gradient, textColor } = getGradientForName(person.name)
  const initials = getInitials(person.name)
  const showFallback = !person.imageUrl || imgError

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 min-w-[80px] p-2 rounded-xl transition-all duration-200',
        'hover:bg-accent/50 cursor-pointer group',
        isSelected && 'bg-accent ring-1 ring-primary/30'
      )}
    >
      <Avatar className="h-16 w-16 ring-2 ring-transparent group-hover:ring-primary/40 transition-all duration-200">
        {person.imageUrl && !imgError && (
          <AvatarImage
            src={person.imageUrl}
            alt={person.name}
            className="object-cover"
            onError={() => setImgError(true)}
          />
        )}
        <AvatarFallback className={cn(
          showFallback
            ? `bg-gradient-to-br ${gradient} ${textColor} font-bold`
            : 'bg-muted text-muted-foreground font-semibold',
          'text-xs'
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="text-center min-w-0 w-full">
        <p className="text-[11px] font-semibold text-foreground truncate">{person.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{person.role || person.type}</p>
      </div>
    </button>
  )
}

// ── Person Detail (Expanded) ────────────────────────────────────────────────────

function PersonDetail({
  person,
  onClose,
}: {
  person: PersonInfo
  onClose: () => void
}) {
  const { setDetailPanelItem } = useAppStore()
  const [filmography, setFilmography] = useState<FilmographyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchFilmography = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/jellyfin/person/${person.id}/filmography`)
      if (res.ok) {
        const data = await res.json()
        setFilmography(data)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [person.id])

  useEffect(() => {
    fetchFilmography()
  }, [fetchFilmography])

  const personDetails = filmography?.person
  const initials = getInitials(person.name)
  const { gradient, textColor } = getGradientForName(person.name)
  const personImageUrl = personDetails?.imageUrl || person.imageUrl
  const [personImgError, setPersonImgError] = useState(false)
  const showPersonFallback = !personImageUrl || personImgError

  return (
    <div className="bg-accent/30 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
      {/* Header with close */}
      <div className="flex items-start gap-4">
        <Avatar className="h-20 w-20 ring-2 ring-primary/20 shrink-0">
          {personImageUrl && !personImgError && (
            <AvatarImage
              src={personImageUrl}
              alt={person.name}
              className="object-cover"
              onError={() => setPersonImgError(true)}
            />
          )}
          <AvatarFallback className={cn(
            showPersonFallback
              ? `bg-gradient-to-br ${gradient} ${textColor} font-bold`
              : 'bg-muted text-muted-foreground font-bold',
            'text-lg'
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground truncate">{person.name}</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 rounded-full hover:bg-accent"
              onClick={onClose}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-semibold">
              {person.type}
            </Badge>
            {person.role && (
              <span className="text-[11px] text-muted-foreground">as {person.role}</span>
            )}
          </div>
          {personDetails?.birthYear ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              <Calendar className="h-2.5 w-2.5 inline mr-1" />
              Born {personDetails.birthYear}
              {personDetails.productionLocations?.[0] && ` in ${personDetails.productionLocations[0]}`}
            </p>
          ) : null}
        </div>
      </div>

      {/* Biography */}
      {personDetails?.overview && (
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
          {personDetails.overview}
        </p>
      )}

      {/* Filmography */}
      <div>
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Film className="h-3 w-3" />
          Other Works
          {filmography && (
            <span className="text-muted-foreground/60">({filmography.total})</span>
          )}
        </h5>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="min-w-[100px] space-y-1.5">
                <Skeleton className="w-[100px] h-[140px] rounded-lg" />
                <Skeleton className="w-16 h-2.5" />
                <Skeleton className="w-10 h-2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-3">
            <p className="text-[11px] text-muted-foreground">Could not load filmography</p>
            <Button variant="ghost" size="sm" onClick={fetchFilmography} className="mt-1 text-[11px] gap-1 h-6">
              <Loader2 className="h-2.5 w-2.5" />
              Retry
            </Button>
          </div>
        ) : filmography && filmography.items.length > 0 ? (
          <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {filmography.items.map((fi) => (
              <button
                key={fi.id}
                onClick={() => {
                  const newItem: MediaItem = {
                    id: fi.id,
                    title: fi.title,
                    description: fi.overview || '',
                    type: fi.type === 'Movie' ? 'MOVIE' : fi.type === 'Series' ? 'TV_SHOW' : 'MUSIC',
                    genre: fi.genres?.join(', ') || '',
                    thumbnail: fi.thumbnail,
                    videoUrl: '',
                    duration: '',
                    durationTicks: fi.runTimeTicks || 0,
                    releaseYear: fi.year || 0,
                    artist: '',
                    views: 0,
                    channel: '',
                    createdAt: '',
                    isJellyfin: true,
                    jellyfinId: fi.jellyfinId,
                    itemType: fi.type,
                    communityRating: fi.communityRating ?? undefined,
                    studios: fi.studios,
                  }
                  setDetailPanelItem(newItem)
                }}
                className="min-w-[100px] max-w-[100px] group cursor-pointer text-left"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted relative">
                  {fi.thumbnail ? (
                    <img
                      src={fi.thumbnail}
                      alt={fi.title}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-6 w-6 text-muted-foreground/20" />
                    </div>
                  )}
                  {fi.communityRating != null && fi.communityRating > 0 && (
                    <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5 flex items-center gap-0.5">
                      <Star className="h-2 w-2 text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] text-white font-semibold">{fi.communityRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] font-medium text-foreground truncate mt-1.5">{fi.title}</p>
                <p className="text-[11px] text-muted-foreground">{fi.year || ''}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No other works found</p>
        )}
      </div>
    </div>
  )
}

// ── Filmography Thumbnail Row ──────────────────────────────────────────────────

function FilmographyRow({ items, label }: { items: SimilarItem[]; label: string }) {
  const { setDetailPanelItem } = useAppStore()
  const LabelIcon = label.includes('Similar') ? Sparkles : Film

  if (!items || items.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <LabelIcon className="h-3.5 w-3.5" />
        {label}
      </h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {items.map((si) => (
          <button
            key={si.id}
            onClick={() => {
              const newItem: MediaItem = {
                id: si.id,
                title: si.title,
                description: si.overview || '',
                type: si.type === 'Movie' ? 'MOVIE' : si.type === 'Series' ? 'TV_SHOW' : 'MUSIC',
                genre: si.genres?.join(', ') || '',
                thumbnail: si.thumbnail,
                videoUrl: '',
                duration: '',
                durationTicks: si.runTimeTicks || 0,
                releaseYear: si.year || 0,
                artist: '',
                views: 0,
                channel: '',
                createdAt: '',
                isJellyfin: true,
                jellyfinId: si.jellyfinId,
                itemType: si.itemType || si.type,
                hasChildren: si.hasChildren,
                childCount: si.childCount,
                communityRating: si.communityRating ?? undefined,
                studios: si.studios,
              }
              setDetailPanelItem(newItem)
            }}
            className="min-w-[95px] max-w-[95px] group cursor-pointer text-left"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted relative">
              {si.thumbnail ? (
                <img
                  src={si.thumbnail}
                  alt={si.title}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="h-6 w-6 text-muted-foreground/20" />
                </div>
              )}
              {si.communityRating != null && si.communityRating > 0 && (
                <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5 flex items-center gap-0.5">
                  <Star className="h-2 w-2 text-yellow-500 fill-yellow-500" />
                  <span className="text-[10px] text-white font-semibold">{si.communityRating.toFixed(1)}</span>
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                <Play className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
              </div>
            </div>
            <p className="text-[11px] font-medium text-foreground truncate mt-1.5">{si.title}</p>
            <div className="flex items-center gap-1">
              {si.year > 0 && <span className="text-[11px] text-muted-foreground">{si.year}</span>}
              {si.isJellyfin && (
                <Server className="h-2 w-2 text-emerald-500" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Digital Music Museum ─────────────────────────────────────────────────────────

function DigitalMusicMuseum({
  item,
  isJellyfinItem,
}: {
  item: MediaItem
  isJellyfinItem: boolean
}) {
  const { setDetailPanelItem, jellyfinConnected } = useAppStore()
  const [artistData, setArtistData] = useState<ArtistInfoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // For non-Jellyfin music items, use enriched metadata
  const [aiArtistData, setAiArtistData] = useState<{
    careerHighlights: CareerHighlight[]
    influences: string[]
    collaborations: string[]
    albumTimeline: { year: number; title: string }[]
  } | null>(null)

  const fetchArtistData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      if (isJellyfinItem && item.jellyfinId && jellyfinConnected) {
        // Try fetching from Jellyfin artist API - it handles album-to-artist resolution
        const res = await fetch(`/api/jellyfin/artist/${item.jellyfinId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.albums && data.albums.length > 0) {
            setArtistData(data)
            setLoading(false)
            return
          }
        }
      }

      // Fallback: Use AI metadata API for artist info
      const artistName = item.albumArtist || item.artist || item.title
      if (artistName) {
        const metaRes = await fetch(`/api/metadata?title=${encodeURIComponent(artistName)}&type=MUSIC`)
        if (metaRes.ok) {
          const meta = await metaRes.json()
          // Build a synthetic artist timeline from metadata
          const careerHighlights: CareerHighlight[] = []
          const albumTimeline: { year: number; title: string }[] = []
          const influences: string[] = meta.similarTitles || []
          const collaborations: string[] = meta.producer || []

          if (item.releaseYear) {
            careerHighlights.push({ year: item.releaseYear, title: item.title, type: 'album' })
            albumTimeline.push({ year: item.releaseYear, title: item.title })
          }

          if (meta.synopsis || meta.trivia) {
            // Try to extract years from trivia/synopsis for career highlights
            const yearRegex = /\b(19|20)\d{2}\b/g
            const synopsisYears = (meta.synopsis || '').match(yearRegex) || []
            const triviaYears = ((meta.trivia || []) as string[]).join(' ').match(yearRegex) || []
            const allYears = [...new Set([...synopsisYears, ...triviaYears])].map(Number).sort((a, b) => a - b)
            for (const year of allYears.slice(0, 5)) {
              careerHighlights.push({ year, title: `Career milestone`, type: 'milestone' })
            }
          }

          setAiArtistData({ careerHighlights, influences, collaborations, albumTimeline })
        }
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [item.jellyfinId, item.albumArtist, item.artist, item.title, item.releaseYear, isJellyfinItem, jellyfinConnected])

  useEffect(() => {
    fetchArtistData()
  }, [fetchArtistData])

  // Determine if this is a music item
  const isMusic = item.type === 'MUSIC' || item.itemType === 'MusicAlbum' || item.itemType === 'Audio' || item.itemType === 'MusicArtist'
  if (!isMusic) return null

  const albums = artistData?.albums || []
  const careerHighlights = artistData?.careerHighlights || aiArtistData?.careerHighlights || []
  const collaborations = artistData?.collaborations || (aiArtistData?.collaborations || []).map((name) => ({ name, id: '' }))
  const influences = aiArtistData?.influences || artistData?.artist?.genres || []
  const albumTimeline = albums.length > 0
    ? albums.map((a) => ({ year: a.year || 0, title: a.name, image: a.imageUrl }))
    : (aiArtistData?.albumTimeline || []).map((a) => ({ year: a.year, title: a.title, image: '' }))

  return (
    <>
      <Separator />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Disc3 className="h-3.5 w-3.5 text-purple-500" />
          Digital Music Museum
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 bg-purple-500/10 text-purple-500 border-purple-500/25 font-semibold">
            BETA
          </Badge>
        </h3>

        {loading ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-36 rounded-lg shrink-0" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-20 rounded-lg shrink-0" />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-3">
            <p className="text-[11px] text-muted-foreground">Could not load music museum data</p>
            <Button variant="ghost" size="sm" onClick={fetchArtistData} className="mt-1 text-[11px] gap-1 h-6">
              <Loader2 className="h-2.5 w-2.5" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Artist Timeline - Career Highlights */}
            {careerHighlights.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  Artist Timeline
                </h4>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-purple-500 via-purple-500/50 to-purple-500/10" />
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {careerHighlights.slice(0, 15).map((highlight, i) => (
                      <div key={i} className="flex items-start gap-2.5 relative">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10',
                          highlight.type === 'album'
                            ? 'bg-purple-500/20 text-purple-500'
                            : highlight.type === 'birth'
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-amber-500/20 text-amber-500'
                        )}>
                          {highlight.type === 'album' ? <Disc className="h-3 w-3" /> :
                           highlight.type === 'birth' ? <span className="text-[10px]">B</span> :
                           <Star className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-foreground/80">{highlight.year}</span>
                            <span className="text-xs text-foreground/70 truncate">{highlight.title}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Album Evolution - Horizontal Timeline */}
            {albumTimeline.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Disc3 className="h-2.5 w-2.5" />
                  Album Evolution
                  <span className="text-muted-foreground/60">({albumTimeline.length})</span>
                </h4>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
                  {albumTimeline.filter(a => a.year > 0).map((album, i) => (
                    <div
                      key={i}
                      className="min-w-[80px] max-w-[80px] group cursor-pointer text-center"
                      onClick={() => {
                        // Navigate to album detail if it has a jellyfinId
                        if (artistData?.albums[i]) {
                          const a = artistData.albums[i]
                          const newItem: MediaItem = {
                            id: a.id,
                            title: a.name,
                            description: a.overview || '',
                            type: 'MUSIC',
                            genre: a.genres?.join(', ') || '',
                            thumbnail: a.imageUrl,
                            videoUrl: '',
                            duration: '',
                            releaseYear: a.year || 0,
                            artist: a.albumArtist || '',
                            views: 0,
                            channel: '',
                            createdAt: '',
                            isJellyfin: true,
                            jellyfinId: a.jellyfinId,
                            itemType: 'MusicAlbum',
                            communityRating: a.communityRating ?? undefined,
                          }
                          setDetailPanelItem(newItem)
                        }
                      }}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
                        {album.image ? (
                          <img
                            src={album.image}
                            alt={album.title}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className={cn(
                            'w-full h-full flex items-center justify-center bg-gradient-to-br',
                            getGradientForName(album.title).gradient
                          )}>
                            <Disc3 className={cn('h-6 w-6', getGradientForName(album.title).textColor, 'opacity-60')} />
                          </div>
                        )}
                        {album.year > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5">
                            <span className="text-[10px] text-white font-semibold">{album.year}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-foreground truncate mt-1">{album.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Influences */}
            {influences.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <GitBranch className="h-2.5 w-2.5" />
                  Influences & Related
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {influences.slice(0, 10).map((influence, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[11px] font-medium gap-1 bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20"
                    >
                      <Zap className="h-2 w-2" />
                      {influence}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Collaborations */}
            {collaborations.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Handshake className="h-2.5 w-2.5" />
                  Collaborations
                  <span className="text-muted-foreground/60">({collaborations.length})</span>
                </h4>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {collaborations.slice(0, 10).map((collab, i) => {
                    const { gradient, textColor } = getGradientForName(collab.name)
                    return (
                      <div
                        key={collab.id || i}
                        className="flex items-center gap-2 bg-accent/30 rounded-lg px-2.5 py-1.5 min-w-0 shrink-0"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={cn('bg-gradient-to-br', gradient, textColor, 'text-[10px] font-bold')}>
                            {getInitials(collab.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] font-medium text-foreground whitespace-nowrap">{collab.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Show message if no data at all */}
            {careerHighlights.length === 0 && albumTimeline.length === 0 && influences.length === 0 && collaborations.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">
                No music museum data available for this item
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── AI Media Summary ────────────────────────────────────────────────────────────

function AIMediaSummary({
  item,
  enrichedData,
  enrichedLoading,
}: {
  item: MediaItem
  enrichedData: EnrichedMetadata | null
  enrichedLoading: boolean
}) {
  // Don't show for music items - they have Digital Music Museum
  const isMusic = item.type === 'MUSIC' || item.itemType === 'MusicAlbum' || item.itemType === 'Audio' || item.itemType === 'MusicArtist'
  if (isMusic) return null

  // Show loading skeleton
  if (enrichedLoading) {
    return (
      <>
        <Separator />
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 text-[11px] px-2 py-0.5 font-semibold">
              <Sparkles className="h-2.5 w-2.5" />
              AI Summary
            </Badge>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      </>
    )
  }

  if (!enrichedData) return null

  // Build the summary content
  const hasSynopsis = !!enrichedData.synopsis
  const hasAwards = enrichedData.awards && enrichedData.awards.length > 0
  const hasTrivia = enrichedData.trivia && enrichedData.trivia.length > 0
  const hasSimilarTitles = enrichedData.similarTitles && enrichedData.similarTitles.length > 0

  // Check if this is a sequel/series - detect from title patterns
  const isSequelOrSeries = /(\d+|part\s+\d+|vol\.?\s+\d+|chapter\s+\d+|ii+|iii+|iv\b)/i.test(item.title) ||
    item.itemType === 'Series' || item.type === 'TV_SHOW'

  if (!hasSynopsis && !hasAwards && !hasTrivia && !hasSimilarTitles) return null

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 text-[11px] px-2 py-0.5 font-semibold">
            <Sparkles className="h-2.5 w-2.5" />
            AI Summary
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Quick 30-Second Summary */}
          {hasSynopsis && (
            <div className="bg-gradient-to-r from-amber-500/5 to-transparent rounded-lg p-3 border border-amber-500/10">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" />
                30-Second Summary
              </h4>
              <p className="text-xs text-foreground/85 leading-relaxed line-clamp-4">
                {enrichedData.synopsis}
              </p>
            </div>
          )}

          {/* Character Overview (for movies/TV shows) */}
          {(item.type === 'MOVIE' || item.type === 'TV_SHOW' || item.itemType === 'Movie' || item.itemType === 'Series') && (
            <div className="bg-gradient-to-r from-cyan-500/5 to-transparent rounded-lg p-3 border border-cyan-500/10">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1.5 flex items-center gap-1">
                <UserCircle className="h-2.5 w-2.5" />
                Character Overview
              </h4>
              <div className="space-y-1.5">
                {enrichedData.criticsConsensus && (
                  <p className="text-xs text-foreground/75 leading-relaxed italic">
                    &ldquo;{enrichedData.criticsConsensus}&rdquo;
                  </p>
                )}
                {hasTrivia && enrichedData.trivia && (
                  <div className="mt-1.5">
                    {enrichedData.trivia.slice(0, 2).map((fact, i) => (
                      <p key={i} className="text-[11px] text-foreground/60 leading-relaxed flex items-start gap-1.5">
                        <span className="text-amber-500/60 mt-0.5 shrink-0">&#9670;</span>
                        {fact}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Franchise Recap (for sequels/series) */}
          {isSequelOrSeries && hasSimilarTitles && (
            <div className="bg-gradient-to-r from-rose-500/5 to-transparent rounded-lg p-3 border border-rose-500/10">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                <GitBranch className="h-2.5 w-2.5" />
                Franchise Recap
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {enrichedData.similarTitles?.map((title) => (
                  <Badge
                    key={title}
                    variant="outline"
                    className="text-[11px] font-medium gap-1 bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  >
                    <Film className="h-2 w-2" />
                    {title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Key Awards - compact view */}
          {hasAwards && enrichedData.awards && (
            <div className="flex flex-wrap gap-1.5">
              {enrichedData.awards.slice(0, 3).map((award, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[11px] font-medium gap-1 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                >
                  <Award className="h-2 w-2" />
                  {award}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function MediaDetailPanel({ item, onClose }: MediaDetailPanelProps) {
  const { setCurrentMedia, jellyfinConnected } = useAppStore()

  // Internet-enriched metadata
  const [enrichedData, setEnrichedData] = useState<EnrichedMetadata | null>(null)
  const [enrichedLoading, setEnrichedLoading] = useState(false)
  const [enrichedError, setEnrichedError] = useState(false)

  // Jellyfin people data
  const [peopleData, setPeopleData] = useState<PeopleData | null>(null)
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [peopleError, setPeopleError] = useState(false)

  // Similar items from NAS
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([])
  const [similarLoading, setSimilarLoading] = useState(false)

  // Selected person for expanded view
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const badge = getTypeBadge(item)
  const TypeIcon = badge.icon
  const genres = getGenres(item, peopleData?.itemMetadata?.genres)
  const durationLabel = formatDuration(item.duration, item.durationTicks || peopleData?.itemMetadata?.runTimeTicks || undefined)
  const resolution = getResolutionLabel(item.width, item.height)
  const audioLabel = getAudioLabel(item.channels)

  // Is this a Jellyfin item that we can fetch people/similar for?
  const isJellyfinItem = !!(item.jellyfinId && jellyfinConnected)

  // Fetch internet-enriched metadata
  const fetchEnriched = useCallback(async () => {
    setEnrichedLoading(true)
    setEnrichedError(false)
    try {
      const params = new URLSearchParams({
        title: item.title,
        type: item.type || 'MOVIE',
      })
      if (item.releaseYear) params.set('year', String(item.releaseYear))
      if (item.artist) params.set('artist', item.artist)
      if (item.seriesName) params.set('series', item.seriesName)

      const res = await fetch(`/api/metadata?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEnrichedData(data)
      } else {
        setEnrichedError(true)
      }
    } catch {
      setEnrichedError(true)
    } finally {
      setEnrichedLoading(false)
    }
  }, [item.title, item.type, item.releaseYear, item.artist, item.seriesName])

  // Fetch Jellyfin people data
  const fetchPeople = useCallback(async () => {
    if (!item.jellyfinId) return
    setPeopleLoading(true)
    setPeopleError(false)
    try {
      const res = await fetch(`/api/jellyfin/people/${item.jellyfinId}`)
      if (res.ok) {
        const data = await res.json()
        setPeopleData(data)
      } else {
        setPeopleError(true)
      }
    } catch {
      setPeopleError(true)
    } finally {
      setPeopleLoading(false)
    }
  }, [item.jellyfinId])

  // Fetch similar items from Jellyfin
  const fetchSimilar = useCallback(async () => {
    if (!item.jellyfinId) return
    setSimilarLoading(true)
    try {
      const res = await fetch(`/api/jellyfin/similar/${item.jellyfinId}`)
      if (res.ok) {
        const data = await res.json()
        setSimilarItems(data.items || [])
      }
    } catch {
      // Silently fail for similar items
    } finally {
      setSimilarLoading(false)
    }
  }, [item.jellyfinId])

  useEffect(() => {
    fetchEnriched()
  }, [fetchEnriched])

  useEffect(() => {
    if (isJellyfinItem) {
      fetchPeople()
      fetchSimilar()
    }
  }, [isJellyfinItem, fetchPeople, fetchSimilar])

  const handlePlay = () => {
    setCurrentMedia(item)
    onClose()
  }

  // Determine synopsis
  const synopsis = enrichedData?.synopsis || peopleData?.itemMetadata?.overview || item.description || 'No description available.'

  // Categorize people
  const cast = peopleData?.people.filter((p) => p.type === 'Actor') || []
  const directors = peopleData?.people.filter((p) => p.type === 'Director') || []
  const writers = peopleData?.people.filter((p) => p.type === 'Writer') || []
  const producers = peopleData?.people.filter((p) => p.type === 'Producer') || []
  const composers = peopleData?.people.filter((p) => p.type === 'Composer') || []
  const otherCrew = peopleData?.people.filter(
    (p) => !['Actor', 'Director', 'Writer', 'Producer', 'Composer'].includes(p.type)
  ) || []

  // Studios (enriched from Jellyfin people API with images)
  const studios = peopleData?.itemMetadata?.studios || []

  // Media sources for technical info
  const mediaSources = peopleData?.itemMetadata?.mediaSources || []
  const primarySource = mediaSources[0]

  // Video/audio/subtitle streams
  const videoStreams = primarySource?.mediaStreams.filter((s) => s.type === 'Video') || []
  const audioStreams = primarySource?.mediaStreams.filter((s) => s.type === 'Audio') || []
  const subtitleStreams = primarySource?.mediaStreams.filter((s) => s.type === 'Subtitle') || []

  const selectedPerson = peopleData?.people.find((p) => p.id === selectedPersonId)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[85vw] sm:w-[400px] max-w-[400px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <ScrollArea className="flex-1">
          {/* ─── 1. Hero Area ─────────────────────────────────────── */}
          <div className="relative aspect-[16/9] max-h-[180px] overflow-hidden">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={cn(
                'w-full h-full flex items-center justify-center',
                'bg-gradient-to-br from-muted via-muted/80 to-muted-foreground/10'
              )}>
                <TypeIcon className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={handlePlay}
                className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30 shadow-lg hover:bg-white/30 transition-all duration-200 hover:scale-110"
              >
                <Play className="h-7 w-7 text-white fill-white ml-1" />
              </button>
            </div>

            {/* Resolution & Audio badges */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              {resolution && (
                <Badge className="gap-1 bg-black/60 text-white border-white/20 backdrop-blur-md text-[11px] px-2 py-0.5 font-semibold">
                  <Film className="h-3 w-3" />
                  {resolution}
                </Badge>
              )}
              {audioLabel && (
                <Badge className="gap-1 bg-black/60 text-white border-white/20 backdrop-blur-md text-[11px] px-2 py-0.5 font-semibold">
                  <Headphones className="h-3 w-3" />
                  {audioLabel}
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 -mt-6 relative z-10">
            {/* Title & Badges */}
            <div>
              <h2 className="text-lg font-bold leading-tight mb-2">{item.title}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={cn('text-[11px] gap-1 font-semibold', badge.color)}>
                  <TypeIcon className="h-3 w-3" />
                  {badge.label}
                </Badge>
                {(item.releaseYear || peopleData?.itemMetadata?.productionYear) > 0 && (
                  <Badge variant="outline" className="text-[11px] font-medium">
                    {item.releaseYear || peopleData?.itemMetadata?.productionYear}
                  </Badge>
                )}
                {durationLabel && (
                  <Badge variant="outline" className="text-[11px] gap-1 font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {durationLabel}
                  </Badge>
                )}
                {(item.communityRating || peopleData?.itemMetadata?.communityRating) != null &&
                  (item.communityRating || peopleData?.itemMetadata?.communityRating || 0) > 0 && (
                  <Badge variant="outline" className="text-[11px] gap-1 font-semibold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/25">
                    <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                    {(item.communityRating || peopleData?.itemMetadata?.communityRating || 0).toFixed(1)}
                  </Badge>
                )}
                {item.isJellyfin && jellyfinConnected && (
                  <Badge variant="outline" className="text-[11px] gap-1 font-semibold bg-emerald-500/15 text-emerald-500 border-emerald-500/25">
                    <Server className="h-2.5 w-2.5" />
                    NAS
                  </Badge>
                )}
              </div>
            </div>

            {/* Play button */}
            <Button
              onClick={handlePlay}
              className="w-full gap-2 h-11 font-semibold"
              size="lg"
            >
              <Play className="h-4 w-4 fill-current" />
              Play {badge.label}
            </Button>

            {/* ─── 2. Scores & Ratings ────────────────────────────── */}
            {(enrichedLoading || enrichedData) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Ratings & Scores
                  </h3>
                  {enrichedLoading ? (
                    <div className="flex items-center gap-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <Skeleton className="w-12 h-12 rounded-full" />
                          <Skeleton className="w-10 h-2" />
                        </div>
                      ))}
                    </div>
                  ) : enrichedData ? (
                    <div className="flex items-start gap-4 flex-wrap">
                      {enrichedData.imdbRating != null && enrichedData.imdbRating > 0 && (
                        <ScoreCircle score={Math.round(enrichedData.imdbRating * 10)} label="IMDb" color="text-yellow-500" />
                      )}
                      {enrichedData.audienceScore != null && enrichedData.audienceScore > 0 && (
                        <ScoreCircle score={enrichedData.audienceScore} label="Audience" color="text-emerald-500" />
                      )}
                      {enrichedData.criticScore != null && enrichedData.criticScore > 0 && (
                        <ScoreCircle score={enrichedData.criticScore} label="Critics" color="text-blue-500" />
                      )}
                      {enrichedData.metacritic != null && enrichedData.metacritic > 0 && (
                        <ScoreCircle score={enrichedData.metacritic} label="Metacritic" color="text-orange-500" />
                      )}
                      {enrichedData.rottenTomatoes && (
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="text-xs font-bold bg-red-500/20 text-red-500 border-red-500/30 px-2 py-1">
                            🍅 {enrichedData.rottenTomatoes}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground font-medium">Rotten Tom.</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {enrichedData?.criticsConsensus && (
                    <p className="text-xs text-muted-foreground italic mt-3 leading-relaxed">
                      &ldquo;{enrichedData.criticsConsensus}&rdquo;
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ─── 3. Synopsis ────────────────────────────────────── */}
            <Separator />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Synopsis
              </h3>
              <p className="text-sm text-foreground/90 leading-relaxed">{synopsis}</p>
            </div>

            {/* ─── 4. Cast Section (MAJOR FEATURE) ─────────────────── */}
            {(peopleLoading || cast.length > 0 || (peopleError && isJellyfinItem)) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Cast
                    {cast.length > 0 && (
                      <span className="text-muted-foreground/60">({cast.length})</span>
                    )}
                  </h3>
                  {peopleLoading ? (
                    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 min-w-[90px]">
                          <Skeleton className="h-16 w-16 rounded-full" />
                          <Skeleton className="w-16 h-2.5" />
                          <Skeleton className="w-12 h-2" />
                        </div>
                      ))}
                    </div>
                  ) : peopleError ? (
                    <div className="text-center py-3">
                      <p className="text-[11px] text-muted-foreground">Could not load cast information</p>
                      <Button variant="ghost" size="sm" onClick={fetchPeople} className="mt-1 text-[11px] gap-1 h-6">
                        <Loader2 className="h-2.5 w-2.5" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                        {cast.map((person) => (
                          <PersonCard
                            key={person.id}
                            person={person}
                            isSelected={selectedPersonId === person.id}
                            onClick={() => setSelectedPersonId(
                              selectedPersonId === person.id ? null : person.id
                            )}
                          />
                        ))}
                      </div>
                      {selectedPerson && selectedPerson?.type === 'Actor' && (
                        <PersonDetail
                          person={selectedPerson}
                          onClose={() => setSelectedPersonId(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Fallback: show cast from item.actors if no Jellyfin people data */}
            {!peopleLoading && !peopleData && item.actors && item.actors.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Cast
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.actors.map((actor) => (
                      <Badge key={actor} variant="secondary" className="text-[11px] font-medium">
                        {actor}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ─── 5. Directors Section ────────────────────────────── */}
            {(peopleLoading || directors.length > 0) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Clapperboard className="h-3.5 w-3.5" />
                    Director{directors.length !== 1 ? 's' : ''}
                  </h3>
                  {peopleLoading ? (
                    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 min-w-[90px]">
                          <Skeleton className="h-16 w-16 rounded-full" />
                          <Skeleton className="w-16 h-2.5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                        {directors.map((person) => (
                          <PersonCard
                            key={person.id}
                            person={person}
                            isSelected={selectedPersonId === person.id}
                            onClick={() => setSelectedPersonId(
                              selectedPersonId === person.id ? null : person.id
                            )}
                          />
                        ))}
                      </div>
                      {selectedPerson && selectedPerson?.type === 'Director' && (
                        <PersonDetail
                          person={selectedPerson}
                          onClose={() => setSelectedPersonId(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Fallback: show directors from item.directors */}
            {!peopleLoading && !peopleData && item.directors && item.directors.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Clapperboard className="h-3.5 w-3.5" />
                    Director{item.directors.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.directors.map((dir) => (
                      <Badge key={dir} variant="secondary" className="text-[11px] font-medium">
                        {dir}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ─── 6. Crew Section ─────────────────────────────────── */}
            {(writers.length > 0 || producers.length > 0 || composers.length > 0 || otherCrew.length > 0) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5" />
                    Crew
                  </h3>
                  <div className="space-y-3">
                    {/* Writers */}
                    {writers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <PenTool className="h-2.5 w-2.5" />
                          Writer{writers.length !== 1 ? 's' : ''}
                        </p>
                        <div className="space-y-2">
                          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                            {writers.map((person) => (
                              <PersonCard
                                key={person.id}
                                person={person}
                                isSelected={selectedPersonId === person.id}
                                onClick={() => setSelectedPersonId(
                                  selectedPersonId === person.id ? null : person.id
                                )}
                              />
                            ))}
                          </div>
                          {selectedPerson && selectedPerson?.type === 'Writer' && (
                            <PersonDetail
                              person={selectedPerson}
                              onClose={() => setSelectedPersonId(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Producers */}
                    {producers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          Producer{producers.length !== 1 ? 's' : ''}
                        </p>
                        <div className="space-y-2">
                          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                            {producers.map((person) => (
                              <PersonCard
                                key={person.id}
                                person={person}
                                isSelected={selectedPersonId === person.id}
                                onClick={() => setSelectedPersonId(
                                  selectedPersonId === person.id ? null : person.id
                                )}
                              />
                            ))}
                          </div>
                          {selectedPerson && selectedPerson?.type === 'Producer' && (
                            <PersonDetail
                              person={selectedPerson}
                              onClose={() => setSelectedPersonId(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Composers */}
                    {composers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Music className="h-2.5 w-2.5" />
                          Composer{composers.length !== 1 ? 's' : ''}
                        </p>
                        <div className="space-y-2">
                          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                            {composers.map((person) => (
                              <PersonCard
                                key={person.id}
                                person={person}
                                isSelected={selectedPersonId === person.id}
                                onClick={() => setSelectedPersonId(
                                  selectedPersonId === person.id ? null : person.id
                                )}
                              />
                            ))}
                          </div>
                          {selectedPerson && selectedPerson?.type === 'Composer' && (
                            <PersonDetail
                              person={selectedPerson}
                              onClose={() => setSelectedPersonId(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Other Crew */}
                    {otherCrew.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />
                          Other Crew
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {otherCrew.slice(0, 10).map((person) => (
                            <Badge
                              key={person.id}
                              variant="secondary"
                              className="text-[11px] font-medium gap-1 cursor-pointer hover:bg-accent/80 transition-colors"
                              onClick={() => setSelectedPersonId(
                                selectedPersonId === person.id ? null : person.id
                              )}
                            >
                              {person.name}
                              {person.role && <span className="text-muted-foreground">({person.role})</span>}
                            </Badge>
                          ))}
                        </div>
                        {selectedPerson && !['Actor', 'Director', 'Writer', 'Producer', 'Composer'].includes(selectedPerson.type) && (
                          <PersonDetail
                            person={selectedPerson}
                            onClose={() => setSelectedPersonId(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ─── 7. Studios Section (ENHANCED) ───────────────────── */}
            {studios.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Studio{studios.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                    {studios.map((studio) => (
                      <div
                        key={studio.id || studio.name}
                        className="flex items-center gap-2.5 bg-accent/30 rounded-lg px-3 py-2 min-w-0"
                      >
                        {studio.imageUrl ? (
                          <img
                            src={studio.imageUrl}
                            alt={studio.name}
                            className="h-8 w-8 rounded object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-xs font-medium text-foreground whitespace-nowrap">{studio.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Fallback studios from item.studios */}
            {!peopleLoading && !peopleData && item.studios && item.studios.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Studio{item.studios.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.studios.map((studio) => (
                      <Badge key={studio} variant="secondary" className="text-[11px] font-medium">
                        {studio}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ─── 8. Technical Info Section (ENHANCED) ────────────── */}
            {primarySource && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" />
                    Technical Info
                  </h3>
                  <div className="space-y-3">
                    {/* Media Source */}
                    <div className="bg-accent/20 rounded-lg p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <HardDrive className="h-2.5 w-2.5" />
                        Media Source
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {primarySource.container && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground">Container:</span>
                            <span className="font-medium uppercase">{primarySource.container}</span>
                          </div>
                        )}
                        {primarySource.size > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground">Size:</span>
                            <span className="font-medium">{formatFileSize(primarySource.size)}</span>
                          </div>
                        )}
                        {primarySource.bitrate > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground">Bitrate:</span>
                            <span className="font-medium">{formatBitrate(primarySource.bitrate)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video Streams */}
                    {videoStreams.length > 0 && (
                      <div className="bg-accent/20 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Film className="h-2.5 w-2.5" />
                          Video
                        </p>
                        {videoStreams.map((stream, i) => (
                          <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {stream.codec && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Codec:</span>
                                <span className="font-medium uppercase">{stream.codec}</span>
                              </div>
                            )}
                            {stream.width && stream.height && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Resolution:</span>
                                <span className="font-medium">{stream.width}×{stream.height}</span>
                              </div>
                            )}
                            {stream.frameRate > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Frame Rate:</span>
                                <span className="font-medium">{stream.frameRate.toFixed(2)} fps</span>
                              </div>
                            )}
                            {stream.bitDepth > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Bit Depth:</span>
                                <span className="font-medium">{stream.bitDepth}-bit</span>
                              </div>
                            )}
                            {stream.bitRate > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Video Bitrate:</span>
                                <span className="font-medium">{formatBitrate(stream.bitRate)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Audio Streams */}
                    {audioStreams.length > 0 && (
                      <div className="bg-accent/20 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Volume2 className="h-2.5 w-2.5" />
                          Audio
                        </p>
                        {audioStreams.map((stream, i) => (
                          <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {stream.codec && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Codec:</span>
                                <span className="font-medium uppercase">{stream.codec}</span>
                              </div>
                            )}
                            {stream.channels > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Channels:</span>
                                <span className="font-medium">{getAudioLabel(stream.channels) || `${stream.channels}ch`}</span>
                              </div>
                            )}
                            {stream.sampleRate > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Sample Rate:</span>
                                <span className="font-medium">{(stream.sampleRate / 1000).toFixed(1)} kHz</span>
                              </div>
                            )}
                            {stream.language && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground">Language:</span>
                                <span className="font-medium">{getLanguageName(stream.language)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Subtitle Tracks */}
                    {subtitleStreams.length > 0 && (
                      <div className="bg-accent/20 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Subtitles className="h-2.5 w-2.5" />
                          Subtitles
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {subtitleStreams.map((stream, i) => (
                            <Badge key={i} variant="outline" className="text-[11px] font-medium gap-1">
                              <Subtitles className="h-2.5 w-2.5" />
                              {stream.displayTitle || stream.language ? getLanguageName(stream.language) : `Track ${i + 1}`}
                              {stream.codec && <span className="text-muted-foreground">({stream.codec.toUpperCase()})</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Fallback basic technical info */}
            {!primarySource && (item.videoCodec || item.audioCodec || item.bitRate) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" />
                    Technical Info
                  </h3>
                  <div className="space-y-2">
                    {(item.videoCodec || item.audioCodec) && (
                      <div className="flex items-start gap-2 text-sm">
                        <Film className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Codec:</span>
                        <span className="font-medium">
                          {[item.videoCodec, item.audioCodec].filter(Boolean).join(' / ').toUpperCase()}
                        </span>
                      </div>
                    )}
                    {item.bitRate != null && item.bitRate > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Bitrate:</span>
                        <span className="font-medium">{(item.bitRate / 1000).toFixed(0)} kbps</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ─── 9. Genre Tags ──────────────────────────────────── */}
            {genres.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Genres</h3>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-[11px] font-medium">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ─── 10. Internet-Enriched Sections ──────────────────── */}
            {enrichedLoading ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </>
            ) : enrichedData ? (
              <>
                {/* Awards */}
                {enrichedData.awards && enrichedData.awards.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5" />
                        Awards & Nominations
                      </h3>
                      <ul className="space-y-1">
                        {enrichedData.awards.map((award, i) => (
                          <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">🏆</span>
                            {award}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Trivia */}
                {enrichedData.trivia && enrichedData.trivia.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" />
                        Trivia
                      </h3>
                      <ul className="space-y-2">
                        {enrichedData.trivia.map((fact, i) => (
                          <li key={i} className="text-sm text-foreground/80 leading-relaxed flex items-start gap-2">
                            <span className="text-muted-foreground/40 mt-0.5 shrink-0">•</span>
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Additional info */}
                {(enrichedData.runtime || enrichedData.budget || enrichedData.boxOffice || enrichedData.network || enrichedData.label || enrichedData.narrator || enrichedData.publisher || enrichedData.seasons || enrichedData.status) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        Additional Information
                      </h3>
                      <div className="space-y-2">
                        {enrichedData.runtime && (
                          <div className="flex items-start gap-2 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Runtime:</span>
                            <span className="font-medium">{enrichedData.runtime}</span>
                          </div>
                        )}
                        {enrichedData.budget && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground shrink-0">💰</span>
                            <span className="text-muted-foreground">Budget:</span>
                            <span className="font-medium">{enrichedData.budget}</span>
                          </div>
                        )}
                        {enrichedData.boxOffice && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground shrink-0">💵</span>
                            <span className="text-muted-foreground">Box Office:</span>
                            <span className="font-medium">{enrichedData.boxOffice}</span>
                          </div>
                        )}
                        {enrichedData.network && (
                          <div className="flex items-start gap-2 text-sm">
                            <Tv className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Network:</span>
                            <span className="font-medium">{enrichedData.network}</span>
                          </div>
                        )}
                        {enrichedData.seasons != null && enrichedData.seasons > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <Tv className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Seasons:</span>
                            <span className="font-medium">{enrichedData.seasons}</span>
                          </div>
                        )}
                        {enrichedData.status && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground shrink-0">📡</span>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="outline" className={cn('text-[11px]',
                              enrichedData.status === 'Running' ? 'text-emerald-500 border-emerald-500/30' :
                              enrichedData.status === 'Ended' ? 'text-muted-foreground' : ''
                            )}>{enrichedData.status}</Badge>
                          </div>
                        )}
                        {enrichedData.label && (
                          <div className="flex items-start gap-2 text-sm">
                            <Music className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Label:</span>
                            <span className="font-medium">{enrichedData.label}</span>
                          </div>
                        )}
                        {enrichedData.producer && enrichedData.producer.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Producer:</span>
                            <span className="font-medium">{enrichedData.producer.join(', ')}</span>
                          </div>
                        )}
                        {enrichedData.narrator && (
                          <div className="flex items-start gap-2 text-sm">
                            <Headphones className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Narrator:</span>
                            <span className="font-medium">{enrichedData.narrator}</span>
                          </div>
                        )}
                        {enrichedData.publisher && (
                          <div className="flex items-start gap-2 text-sm">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">Publisher:</span>
                            <span className="font-medium">{enrichedData.publisher}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Streaming On */}
                {enrichedData.streamingOn && enrichedData.streamingOn.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Available On
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichedData.streamingOn.map((platform) => (
                          <Badge key={platform} variant="secondary" className="text-[11px] font-medium gap-1">
                            <Globe className="h-2.5 w-2.5" />
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Similar Titles (from internet) */}
                {enrichedData.similarTitles && enrichedData.similarTitles.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Film className="h-3.5 w-3.5" />
                        You May Also Like
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {enrichedData.similarTitles.map((title) => (
                          <Badge key={title} variant="outline" className="text-[11px] font-medium">
                            {title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : enrichedError ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">Could not load internet metadata</p>
                <Button variant="ghost" size="sm" onClick={fetchEnriched} className="mt-2 text-xs gap-1">
                  <Loader2 className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : null}

            {/* ─── 11. Similar From Your NAS ────────────────────────── */}
            {(similarLoading || similarItems.length > 0) && isJellyfinItem && (
              <>
                <Separator />
                <FilmographyRow
                  items={similarItems}
                  label="Similar on Your NAS"
                />
                {similarLoading && similarItems.length === 0 && (
                  <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="min-w-[95px] max-w-[95px] space-y-1.5">
                        <Skeleton className="w-full aspect-[2/3] rounded-lg" />
                        <Skeleton className="w-20 h-2.5" />
                        <Skeleton className="w-12 h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── 12. Digital Music Museum ───────────────────────────── */}
            <DigitalMusicMuseum item={item} isJellyfinItem={isJellyfinItem} />

            {/* ─── 13. AI Media Summary ──────────────────────────────── */}
            <AIMediaSummary item={item} enrichedData={enrichedData} enrichedLoading={enrichedLoading} />

            {/* ─── Extra metadata fields ─────────────────────────────── */}
            {(peopleData?.itemMetadata?.officialRating || peopleData?.itemMetadata?.premiereDate || (peopleData?.itemMetadata?.productionLocations && peopleData.itemMetadata.productionLocations.length > 0) || item.seriesName || item.albumArtist || item.album) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    More Details
                  </h3>
                  <div className="space-y-2">
                    {peopleData?.itemMetadata?.officialRating && (
                      <div className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="text-[11px] font-bold px-1.5 py-0">{peopleData.itemMetadata.officialRating}</Badge>
                        <span className="text-muted-foreground">Content Rating</span>
                      </div>
                    )}
                    {peopleData?.itemMetadata?.premiereDate && (
                      <div className="flex items-start gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Premiered:</span>
                        <span className="font-medium">{new Date(peopleData.itemMetadata.premiereDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {peopleData?.itemMetadata?.productionLocations && peopleData.itemMetadata.productionLocations.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Country:</span>
                        <span className="font-medium">{peopleData.itemMetadata.productionLocations.join(', ')}</span>
                      </div>
                    )}
                    {item.seriesName && (
                      <div className="flex items-start gap-2 text-sm">
                        <Tv className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Series:</span>
                        <span className="font-medium">{item.seriesName}</span>
                      </div>
                    )}
                    {item.seasonNumber != null && item.episodeNumber != null && (
                      <div className="flex items-start gap-2 text-sm">
                        <Tv className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Episode:</span>
                        <span className="font-medium">S{item.seasonNumber}E{item.episodeNumber}</span>
                      </div>
                    )}
                    {item.albumArtist && (
                      <div className="flex items-start gap-2 text-sm">
                        <Music className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Artist:</span>
                        <span className="font-medium">{item.albumArtist}</span>
                      </div>
                    )}
                    {item.album && (
                      <div className="flex items-start gap-2 text-sm">
                        <Music className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">Album:</span>
                        <span className="font-medium">{item.album}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Bottom spacing */}
            <div className="h-4" />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
