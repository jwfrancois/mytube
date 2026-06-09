'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, RadioStation } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Radio,
  Search,
  Globe,
  Music,
  Heart,
  Play,
  Pause,
  Signal,
  Star,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Wifi,
  RefreshCw,
  X,
  Volume2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURATED_GENRES, CURATED_COUNTRIES } from '@/lib/radio-browser'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FetchedStation {
  stationId: string
  name: string
  streamUrl: string
  homepage: string
  favicon: string
  country: string
  countryCode: string
  genre: string
  tags: string
  bitrate: number
  codec: string
  votes: number
  language: string
  clickCount: number
  clickTrend: number
  lastCheckOk: boolean
  hls: boolean
}

type BrowseView = 'home' | 'genre' | 'country' | 'search'

// ─── Station Card ─────────────────────────────────────────────────────────────

function StationCard({
  station,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
  compact = false,
}: {
  station: FetchedStation | RadioStation
  isPlaying: boolean
  isFavorite: boolean
  onPlay: () => void
  onToggleFavorite: () => void
  compact?: boolean
}) {
  const favicon = 'favicon' in station ? station.favicon : undefined
  const bitrate = 'bitrate' in station ? station.bitrate : undefined
  const codec = 'codec' in station ? station.codec : undefined
  const country = 'country' in station ? station.country : undefined
  const tags = 'tags' in station ? station.tags : undefined
  const votes = 'votes' in station ? station.votes : undefined

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-300 cursor-pointer",
        "bg-card/50 hover:bg-card/80 backdrop-blur-sm",
        isPlaying
          ? "border-mythic/40 ring-1 ring-mythic/20 shadow-lg shadow-mythic/10"
          : "border-border/30 hover:border-border/60",
        compact ? "p-3" : "p-4"
      )}
      onClick={onPlay}
    >
      {/* Station thumbnail / favicon */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "relative shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-mythic/20 to-orange-500/20 flex items-center justify-center",
          compact ? "w-10 h-10" : "w-14 h-14"
        )}>
          {favicon ? (
            <img
              src={favicon}
              alt={station.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const sibling = (e.target as HTMLImageElement).nextElementSibling
                if (sibling) sibling.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={cn(favicon ? 'hidden' : '', "flex items-center justify-center w-full h-full")}>
            <Radio className={cn(compact ? "h-4 w-4" : "h-6 w-6", "text-mythic/60")} />
          </div>
          {/* Playing indicator overlay */}
          {isPlaying && (
            <div className="absolute inset-0 bg-mythic/30 flex items-center justify-center">
              <div className="flex gap-0.5 items-end h-4">
                <span className="w-0.5 bg-white rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate]" style={{ height: '40%' }} />
                <span className="w-0.5 bg-white rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.2s]" style={{ height: '70%' }} />
                <span className="w-0.5 bg-white rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.4s]" style={{ height: '50%' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              "font-semibold truncate leading-tight",
              compact ? "text-xs" : "text-sm",
              isPlaying && "text-mythic"
            )}>
              {station.name}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
              className={cn(
                "shrink-0 p-1 rounded-full transition-all",
                isFavorite
                  ? "text-red-400 hover:text-red-300"
                  : "text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100"
              )}
            >
              <Heart className={cn("fill-current", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {country && (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px]">{country}</span>
            )}
            {bitrate && bitrate > 0 && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-white/5 border-white/10">
                {bitrate}kbps
              </Badge>
            )}
            {codec && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-white/5 border-white/10 uppercase">
                {codec}
              </Badge>
            )}
            {votes !== undefined && votes > 0 && (
              <span className="text-[9px] text-amber-400/60 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5" />{votes}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags && !compact && (
            <div className="flex gap-1 mt-1.5 overflow-hidden">
              {tags.split(',').slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground/50 truncate max-w-[80px]">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Play button overlay on hover */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-mythic flex items-center justify-center shadow-lg shadow-mythic/30">
            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Now Playing Bar ──────────────────────────────────────────────────────────

function RadioNowPlaying({
  station,
  isPlaying,
  onTogglePlay,
  onStop,
}: {
  station: RadioStation
  isPlaying: boolean
  onTogglePlay: () => void
  onStop: () => void
}) {
  return (
    <div className="relative mx-6 mb-6 rounded-xl border border-mythic/20 bg-gradient-to-r from-mythic/10 via-orange-500/5 to-pink-500/5 backdrop-blur-sm overflow-hidden">
      {/* Animated background wave */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-mythic/5 via-transparent to-purple-500/5" />
        {isPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-8 animate-pulse" style={{
            background: 'linear-gradient(0deg, rgba(234,88,12,0.08) 0%, transparent 100%)',
          }} />
        )}
      </div>

      <div className="relative flex items-center gap-4 p-4">
        {/* Station icon with animated ring */}
        <div className="relative shrink-0">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-mythic/30 to-orange-500/30",
            isPlaying && "ring-2 ring-mythic/40 ring-offset-2 ring-offset-background"
          )}>
            {station.favicon ? (
              <img src={station.favicon} alt="" className="w-10 h-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <Radio className="h-6 w-6 text-mythic" />
            )}
          </div>
          {isPlaying && (
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <Signal className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Station info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold truncate">{station.name}</h3>
            {isPlaying && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                LIVE
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {station.country && (
              <span className="text-xs text-muted-foreground/60">{station.country}</span>
            )}
            {station.genre && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/5">
                {station.genre}
              </Badge>
            )}
            {station.bitrate ? (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/5">
                {station.bitrate}kbps
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full",
              isPlaying
                ? "bg-mythic hover:bg-mythic/90"
                : "bg-gradient-to-r from-mythic to-orange-500 hover:from-mythic/90 hover:to-orange-500/90"
            )}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current text-white" />
            ) : (
              <Play className="h-5 w-5 fill-current text-white ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onStop}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InternetRadio() {
  const {
    radioStation,
    setRadioStation,
    radioFavorites,
    addRadioFavorite,
    removeRadioFavorite,
    isPlaying,
    setIsPlaying,
    setAudioTrack,
    stopAudio,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<string>('discover')
  const [browseView, setBrowseView] = useState<BrowseView>('home')
  const [stations, setStations] = useState<FetchedStation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')

  // Determine if radio is currently playing
  const radioPlaying = !!(radioStation && isPlaying && useAppStore.getState().audioTrack?.type === 'RADIO')

  // Check if a station is in favorites
  const isFavorite = useCallback((stationId: string) => {
    return radioFavorites.some(f => f.stationId === stationId)
  }, [radioFavorites])

  // Play a radio station — delegates to the AudioPlayerBar via the store
  const playStation = useCallback((station: FetchedStation | RadioStation) => {
    const radioStationData: RadioStation = {
      stationId: station.stationId,
      name: station.name,
      streamUrl: station.streamUrl,
      homepage: station.homepage || '',
      favicon: station.favicon || '',
      country: station.country || '',
      countryCode: station.countryCode || '',
      genre: station.genre || '',
      tags: station.tags || '',
      bitrate: station.bitrate || 0,
      codec: station.codec || '',
      votes: station.votes || 0,
      language: station.language || '',
    }
    setRadioStation(radioStationData)

    // Set up as a MediaItem so the AudioPlayerBar can play it
    // NOTE: We only set audioTrack, NOT currentMedia — this keeps the user
    // on the Radio page instead of navigating to the VideoPlayer
    const mediaItem = {
      id: `radio-${station.stationId}`,
      title: station.name,
      description: `${station.genre || 'Radio'} • ${station.country || 'Unknown'}`,
      type: 'RADIO' as const,
      genre: station.genre || '',
      thumbnail: station.favicon || '',
      videoUrl: station.streamUrl,
      duration: 'LIVE',
      releaseYear: 0,
      artist: station.country || '',
      views: station.votes || 0,
      channel: 'Internet Radio',
      createdAt: new Date().toISOString(),
    }
    setAudioTrack(mediaItem)
    setIsPlaying(true)

    // Click tracking — helps station ranking in RadioBrowser
    fetch('/api/radio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationUuid: station.stationId }),
    }).catch(() => {})
  }, [setRadioStation, setAudioTrack, setIsPlaying])

  // Stop radio
  const stopRadio = useCallback(() => {
    setRadioStation(null)
    stopAudio()
  }, [setRadioStation, stopAudio])

  // Toggle play/pause for current station
  const toggleRadioPlay = useCallback(() => {
    if (radioPlaying) {
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
    }
  }, [radioPlaying, setIsPlaying])

  // Toggle favorite
  const toggleFavorite = useCallback((station: FetchedStation | RadioStation) => {
    const radioStationData: RadioStation = {
      stationId: station.stationId,
      name: station.name,
      streamUrl: station.streamUrl,
      homepage: station.homepage || '',
      favicon: station.favicon || '',
      country: station.country || '',
      countryCode: station.countryCode || '',
      genre: station.genre || '',
      tags: station.tags || '',
      bitrate: station.bitrate || 0,
      codec: station.codec || '',
      votes: station.votes || 0,
      language: station.language || '',
    }
    if (isFavorite(station.stationId)) {
      removeRadioFavorite(station.stationId)
    } else {
      addRadioFavorite(radioStationData)
    }
  }, [isFavorite, addRadioFavorite, removeRadioFavorite])

  // Fetch stations
  const fetchStations = useCallback(async (action: string, params?: Record<string, string>) => {
    setIsLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams({ action, ...(params || {}) })
      const res = await fetch(`/api/radio?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch stations')
      const data = await res.json()
      setStations(data.stations || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load stations')
      setStations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load top stations on mount
  useEffect(() => {
    fetchStations('top', { limit: '50' })
  }, [fetchStations])

  // Handle search
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    setBrowseView('search')
    fetchStations('search', { q: searchQuery, limit: '50' })
  }, [searchQuery, fetchStations])

  // Handle genre click
  const handleGenreClick = useCallback((genreId: string, genreName: string) => {
    setSelectedGenre(genreName)
    setBrowseView('genre')
    fetchStations('tag', { tag: genreId, limit: '100' })
  }, [fetchStations])

  // Handle country click
  const handleCountryClick = useCallback((code: string, name: string) => {
    setSelectedCountry(name)
    setBrowseView('country')
    fetchStations('country', { code, limit: '100' })
  }, [fetchStations])

  // Handle back navigation
  const handleBack = useCallback(() => {
    setBrowseView('home')
    setError(null)
  }, [])

  // Check if current audio track is a radio station for display purposes
  const currentRadioStationId = radioStation?.stationId

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/30 p-4 space-y-3">
          <div className="flex gap-3">
            <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // Render station grid
  const renderStationGrid = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Failed to load stations</p>
          <p className="text-xs text-muted-foreground/60 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchStations('top', { limit: '50' })} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />Try Again
          </Button>
        </div>
      )
    }

    if (stations.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Radio className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No stations found</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try a different search or browse by genre</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stations.map((station) => (
          <StationCard
            key={station.stationId}
            station={station}
            isPlaying={currentRadioStationId === station.stationId && isPlaying}
            isFavorite={isFavorite(station.stationId)}
            onPlay={() => playStation(station)}
            onToggleFavorite={() => toggleFavorite(station)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="py-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-6 mb-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-mythic/20 to-orange-500/20 border border-mythic/15">
          <Radio className="h-5 w-5 text-mythic" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Internet Radio</h1>
          <p className="text-xs text-muted-foreground/60">50,000+ live stations from around the world</p>
        </div>
        {radioStation && (
          <Badge variant="outline" className="text-[9px] px-2 py-0.5 h-5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
            <Signal className="h-2.5 w-2.5 mr-1" />TUNED IN
          </Badge>
        )}
      </div>

      {/* Now Playing */}
      {radioStation && (
        <RadioNowPlaying
          station={radioStation}
          isPlaying={isPlaying && useAppStore.getState().audioTrack?.type === 'RADIO'}
          onTogglePlay={toggleRadioPlay}
          onStop={stopRadio}
        />
      )}

      {/* Search Bar */}
      <div className="flex gap-2 px-6 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search radio stations..."
            className="pl-9 h-10 bg-white/5 border-white/10 focus:border-mythic/50 rounded-lg backdrop-blur-sm"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          className="h-10 px-4 rounded-lg bg-mythic hover:bg-mythic/90 text-white gap-1.5 shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Breadcrumb / Back Navigation */}
      {browseView !== 'home' && (
        <div className="flex items-center gap-2 px-6 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Radio
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
          <span className="text-xs font-medium">
            {browseView === 'genre' && selectedGenre}
            {browseView === 'country' && selectedCountry}
            {browseView === 'search' && `Search: "${searchQuery}"`}
          </span>
        </div>
      )}

      {/* Content */}
      {browseView === 'home' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white/5 border border-white/10 mb-5 mx-6">
            <TabsTrigger value="discover" className="text-xs data-[state=active]:bg-mythic/20 data-[state=active]:text-mythic">
              <Wifi className="h-3.5 w-3.5 mr-1.5" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="genres" className="text-xs data-[state=active]:bg-mythic/20 data-[state=active]:text-mythic">
              <Music className="h-3.5 w-3.5 mr-1.5" />
              Genres
            </TabsTrigger>
            <TabsTrigger value="countries" className="text-xs data-[state=active]:bg-mythic/20 data-[state=active]:text-mythic">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Countries
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs data-[state=active]:bg-mythic/20 data-[state=active]:text-mythic">
              <Heart className="h-3.5 w-3.5 mr-1.5" />
              Favorites
              {radioFavorites.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5 min-w-3">
                  {radioFavorites.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Discover Tab */}
          <TabsContent value="discover" className="mt-0 px-6">
            {isLoading ? renderSkeleton() : renderStationGrid()}
          </TabsContent>

          {/* Genres Tab */}
          <TabsContent value="genres" className="mt-0 px-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {CURATED_GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => handleGenreClick(genre.id, genre.name)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-br from-card/80 to-card/40",
                    "border border-border/20 hover:border-border/50",
                    "transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <span className="text-2xl mb-2 block">{genre.icon}</span>
                  <p className="text-sm font-semibold leading-tight">{genre.name}</p>
                  <ChevronRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Countries Tab */}
          <TabsContent value="countries" className="mt-0 px-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {CURATED_COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountryClick(country.code, country.name)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-br from-card/80 to-card/40",
                    "border border-border/20 hover:border-border/50",
                    "transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <span className="text-2xl mb-2 block">{country.flag}</span>
                  <p className="text-sm font-semibold leading-tight truncate">{country.name}</p>
                  <ChevronRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="mt-0 px-6">
            {radioFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Heart className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No favorite stations yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click the heart icon on any station to save it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {radioFavorites.map((station) => (
                  <StationCard
                    key={station.stationId}
                    station={station}
                    isPlaying={currentRadioStationId === station.stationId && isPlaying}
                    isFavorite={true}
                    onPlay={() => playStation(station)}
                    onToggleFavorite={() => removeRadioFavorite(station.stationId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* Browsed view (genre, country, search results) */
        <div className="px-6">
          {isLoading ? renderSkeleton() : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground/60">
                  {stations.length} station{stations.length !== 1 ? 's' : ''} found
                </p>
              </div>
              {renderStationGrid()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
