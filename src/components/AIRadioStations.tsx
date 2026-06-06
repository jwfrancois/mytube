'use client'

import { useState, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Radio,
  Brain,
  Moon,
  Coffee,
  Zap,
  CloudRain,
  Sunset,
  Sun,
  Skull,
  Music,
  Disc3,
  Send,
  RotateCcw,
  AlertCircle,
  Play,
  Pause,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIRadioStationsProps {
  onPlay: (item: MediaItem) => void
}

// --- Mood Station Definitions ---

interface MoodStation {
  id: string
  name: string
  mood: string
  icon: React.ElementType
  gradient: string
  iconColor: string
}

const MOOD_STATIONS: MoodStation[] = [
  { id: 'deep-focus', name: 'Deep Focus', mood: 'deep focus concentration', icon: Brain, gradient: 'from-violet-600 to-purple-800', iconColor: 'text-violet-200' },
  { id: 'night-drive', name: 'Night Drive', mood: 'night drive atmospheric', icon: Moon, gradient: 'from-slate-700 to-blue-900', iconColor: 'text-blue-200' },
  { id: 'sunday-coffee', name: 'Sunday Morning Coffee', mood: 'sunday morning coffee cozy', icon: Coffee, gradient: 'from-amber-600 to-orange-800', iconColor: 'text-amber-200' },
  { id: 'workout-beast', name: 'Workout Beast Mode', mood: 'workout beast mode energetic', icon: Zap, gradient: 'from-red-600 to-orange-700', iconColor: 'text-red-200' },
  { id: 'rainy-day', name: 'Relaxing Rainy Day', mood: 'relaxing rainy day calm', icon: CloudRain, gradient: 'from-cyan-600 to-blue-800', iconColor: 'text-cyan-200' },
  { id: 'melancholy', name: 'Melancholy Evening', mood: 'melancholy evening nostalgic', icon: Sunset, gradient: 'from-rose-600 to-purple-900', iconColor: 'text-rose-200' },
  { id: 'summer-vibes', name: 'Summer Vibes', mood: 'summer vibes upbeat cheerful', icon: Sun, gradient: 'from-yellow-500 to-amber-600', iconColor: 'text-yellow-100' },
  { id: 'dark-ambient', name: 'Dark Ambient', mood: 'dark ambient eerie atmospheric', icon: Skull, gradient: 'from-gray-800 to-gray-950', iconColor: 'text-gray-300' },
]

// --- Genre Fusion Definitions ---

interface GenreFusion {
  id: string
  name: string
  genre: string
  gradientLeft: string
  gradientRight: string
}

const GENRE_FUSIONS: GenreFusion[] = [
  { id: 'jazz-lofi', name: 'Jazz + Lo-Fi', genre: 'jazz lo-fi', gradientLeft: 'from-amber-500', gradientRight: 'to-purple-600' },
  { id: 'classical-electronic', name: 'Classical + Electronic', genre: 'classical electronic', gradientLeft: 'from-emerald-500', gradientRight: 'to-cyan-600' },
  { id: 'blues-rock', name: 'Blues + Rock', genre: 'blues rock', gradientLeft: 'from-blue-600', gradientRight: 'to-red-600' },
  { id: 'ambient-world', name: 'Ambient + World', genre: 'ambient world', gradientLeft: 'from-teal-500', gradientRight: 'to-orange-500' },
]

// --- Active Station State ---

interface ActiveStation {
  stationName: string
  description: string
  tracks: MediaItem[]
}

export function AIRadioStations({ onPlay }: AIRadioStationsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeStation, setActiveStation] = useState<ActiveStation | null>(null)
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [personalizedInput, setPersonalizedInput] = useState('')
  const [activeTab, setActiveTab] = useState('mood')

  const { setAudioQueue, setAudioQueueIndex, setCurrentMedia, isPlaying, audioTrack } = useAppStore()

  const isCurrentStationPlaying = activeStation && audioTrack &&
    activeStation.tracks.some(t => t.id === audioTrack.id)

  const handleStationClick = useCallback(async (
    stationId: string,
    type: 'mood' | 'genre' | 'personalized',
    value: string
  ) => {
    setIsLoading(true)
    setError(null)
    setActiveStationId(stationId)

    try {
      const body: Record<string, string> = { type }
      if (type === 'mood') body.mood = value
      else if (type === 'genre') body.genre = value
      else body.description = value

      const res = await fetch('/api/ai/radio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create station')
      }

      const data = await res.json()
      const tracks: MediaItem[] = data.tracks || []

      setActiveStation({
        stationName: data.stationName || 'Custom Radio',
        description: data.description || '',
        tracks,
      })

      // Auto-play: populate the audio queue and start the first track
      if (tracks.length > 0) {
        setAudioQueue(tracks)
        setAudioQueueIndex(0)
        setCurrentMedia(tracks[0])
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [setAudioQueue, setAudioQueueIndex, setCurrentMedia])

  const handlePersonalizedSubmit = useCallback(() => {
    if (!personalizedInput.trim()) return
    handleStationClick('personalized', 'personalized', personalizedInput)
  }, [personalizedInput, handleStationClick])

  const handleRetry = useCallback(() => {
    setError(null)
    // Re-try with the same station
    if (activeStationId) {
      const moodStation = MOOD_STATIONS.find(s => s.id === activeStationId)
      if (moodStation) {
        handleStationClick(activeStationId, 'mood', moodStation.mood)
        return
      }
      const genreFusion = GENRE_FUSIONS.find(s => s.id === activeStationId)
      if (genreFusion) {
        handleStationClick(activeStationId, 'genre', genreFusion.genre)
        return
      }
    }
  }, [activeStationId, handleStationClick])

  return (
    <div className="px-6 mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15">
          <Radio className="h-4.5 w-4.5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">AI Radio Stations</h2>
          <p className="text-[11px] text-muted-foreground/60">Curated stations powered by AI from your library</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 mb-5">
          <TabsTrigger value="mood" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Mood Stations
          </TabsTrigger>
          <TabsTrigger value="genre" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Music className="h-3.5 w-3.5 mr-1.5" />
            Genre Fusion
          </TabsTrigger>
          <TabsTrigger value="personalized" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Personalized
          </TabsTrigger>
        </TabsList>

        {/* Mood Stations */}
        <TabsContent value="mood" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MOOD_STATIONS.map((station) => {
              const Icon = station.icon
              const isActive = activeStationId === station.id
              return (
                <button
                  key={station.id}
                  onClick={() => handleStationClick(station.id, 'mood', station.mood)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-br",
                    station.gradient,
                    "transition-all duration-300",
                    "hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isActive && "ring-2 ring-white/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  {/* Decorative glow */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-xl -translate-y-1/3 translate-x-1/3" />

                  <div className="relative z-10">
                    <Icon className={cn("h-6 w-6 mb-2", station.iconColor)} />
                    <p className="text-sm font-semibold text-white/90 leading-tight">{station.name}</p>
                    {isActive && activeStation && (
                      <div className="flex items-center gap-1 mt-2">
                        {isCurrentStationPlaying && isPlaying ? (
                          <div className="flex items-center gap-1">
                            <div className="flex gap-0.5">
                              <span className="w-0.5 h-2 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate]" />
                              <span className="w-0.5 h-3 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.2s]" />
                              <span className="w-0.5 h-2 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.4s]" />
                            </div>
                            <span className="text-[10px] text-white/70 ml-1">Playing</span>
                          </div>
                        ) : isActive ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/10 text-white/70 border-white/20">
                            Loaded
                          </Badge>
                        ) : null}
                      </div>
                    )}
                    {isLoading && isActive && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-[10px] text-white/60">Loading...</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </TabsContent>

        {/* Genre Fusion */}
        <TabsContent value="genre" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GENRE_FUSIONS.map((fusion) => {
              const isActive = activeStationId === fusion.id
              return (
                <button
                  key={fusion.id}
                  onClick={() => handleStationClick(fusion.id, 'genre', fusion.genre)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-r",
                    fusion.gradientLeft,
                    fusion.gradientRight,
                    "transition-all duration-300",
                    "hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isActive && "ring-2 ring-white/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  {/* Split line effect */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 -translate-x-1/2" />

                  <div className="relative z-10">
                    <Disc3 className="h-6 w-6 mb-2 text-white/80" />
                    <p className="text-sm font-semibold text-white/90 leading-tight">{fusion.name}</p>
                    {isActive && activeStation && (
                      <div className="flex items-center gap-1 mt-2">
                        {isCurrentStationPlaying && isPlaying ? (
                          <div className="flex items-center gap-1">
                            <div className="flex gap-0.5">
                              <span className="w-0.5 h-2 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate]" />
                              <span className="w-0.5 h-3 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.2s]" />
                              <span className="w-0.5 h-2 bg-white/60 rounded-full animate-[sound_0.4s_ease-in-out_infinite_alternate_0.4s]" />
                            </div>
                            <span className="text-[10px] text-white/70 ml-1">Playing</span>
                          </div>
                        ) : isActive ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/10 text-white/70 border-white/20">
                            Loaded
                          </Badge>
                        ) : null}
                      </div>
                    )}
                    {isLoading && isActive && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-[10px] text-white/60">Loading...</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </TabsContent>

        {/* Personalized */}
        <TabsContent value="personalized" className="mt-0">
          <div className={cn(
            "rounded-xl p-5",
            "bg-gradient-to-br from-purple-500/8 via-pink-500/5 to-purple-600/5",
            "border border-purple-500/15"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200">Create Your Own Station</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <Input
                value={personalizedInput}
                onChange={(e) => setPersonalizedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePersonalizedSubmit()}
                placeholder="e.g., Play songs I haven't heard in 6 months"
                disabled={isLoading}
                className={cn(
                  "h-10 bg-white/5 border-purple-500/20 focus:border-purple-400/50",
                  "placeholder:text-muted-foreground/40",
                  "rounded-lg backdrop-blur-sm"
                )}
              />
              <Button
                onClick={handlePersonalizedSubmit}
                disabled={isLoading || !personalizedInput.trim()}
                className={cn(
                  "h-10 px-4 rounded-lg font-semibold gap-1.5 shrink-0",
                  "bg-gradient-to-r from-purple-500 to-pink-500",
                  "hover:from-purple-600 hover:to-pink-600",
                  "shadow-lg shadow-purple-500/25",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] text-muted-foreground/40 self-center">Quick ideas:</span>
              {[
                'Play songs I haven\'t heard in 6 months',
                'Play my favorite tracks from the last year',
                'Surprise me with something different',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setPersonalizedInput(suggestion)
                    handleStationClick('personalized', 'personalized', suggestion)
                  }}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-[11px] rounded-full bg-white/5 border border-purple-500/15 text-muted-foreground/60 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/25 transition-all duration-200 cursor-pointer disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15 mt-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Active Station Now Playing */}
      {activeStation && !error && (
        <div className="mt-5">
          {/* Station Info */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg",
              "bg-gradient-to-br from-purple-500 to-pink-500",
              "shadow-md shadow-purple-500/20"
            )}>
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">{activeStation.stationName}</h3>
              <p className="text-[11px] text-muted-foreground/60 truncate">{activeStation.description}</p>
            </div>
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 bg-purple-500/10 text-purple-300 border-purple-500/20 shrink-0">
              {activeStation.tracks.length} tracks
            </Badge>
          </div>

          {/* Loading State for Tracks */}
          {isLoading && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[200px] sm:w-[220px] space-y-2">
                  <Skeleton className="aspect-video rounded-lg w-full shimmer" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Track List */}
          {!isLoading && activeStation.tracks.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
              {activeStation.tracks.map((track, idx) => (
                <div key={`${track.id}-${idx}`} className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px]">
                  <MediaCard item={track} onPlay={onPlay} />
                </div>
              ))}
            </div>
          )}

          {/* No Tracks */}
          {!isLoading && activeStation.tracks.length === 0 && (
            <div className="text-center py-6">
              <Radio className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">No tracks found for this station.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
