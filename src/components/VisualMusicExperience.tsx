'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { AudioVisualizer } from '@/components/AudioVisualizer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  Image,
  Network,
  Clock,
  Music,
  Podcast,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

type VisualMode = 'visualizer' | 'album_art' | 'relationship' | 'timeline'

interface VisualMusicExperienceProps {
  currentMedia: MediaItem
  audioElement: HTMLAudioElement | HTMLVideoElement | null
  isPlaying: boolean
}

// --- Map of icon components by type ---

const typeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PODCAST: Podcast,
  AUDIOBOOK: BookOpen,
  MUSIC: Music,
}

// --- Floating Particle Component (CSS-based) ---

function FloatingParticles({ isPlaying }: { isPlaying: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      size: 3 + Math.random() * 5,
      left: 10 + Math.random() * 80,
      top: 10 + Math.random() * 80,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 4,
    })),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className={cn(
            "absolute rounded-full bg-white/10",
            isPlaying ? "animate-pulse" : "opacity-20"
          )}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

// --- Mode 1: Enhanced Visualizer ---

function EnhancedVisualizerMode({
  currentMedia,
  audioElement,
  isPlaying,
}: {
  currentMedia: MediaItem
  audioElement: HTMLAudioElement | HTMLVideoElement | null
  isPlaying: boolean
}) {
  const colorScheme = currentMedia.type === 'PODCAST' ? 'emerald' : currentMedia.type === 'AUDIOBOOK' ? 'amber' : 'purple'

  return (
    <div className="relative w-full h-full">
      <AudioVisualizer
        audioElement={audioElement}
        isPlaying={isPlaying}
        colorScheme={colorScheme}
        height={400}
        className="w-full h-full"
      />
      <FloatingParticles isPlaying={isPlaying} />
    </div>
  )
}

// --- Mode 2: Animated Album Art ---

function AnimatedAlbumArtMode({
  currentMedia,
  isPlaying,
}: {
  currentMedia: MediaItem
  isPlaying: boolean
}) {
  const TypeIconComponent = typeIconMap[currentMedia.type] || Music

  // Simulated gradient based on type
  const bgGradient = currentMedia.type === 'PODCAST'
    ? 'from-emerald-900/60 via-teal-900/40 to-background/80'
    : currentMedia.type === 'AUDIOBOOK'
    ? 'from-amber-900/60 via-orange-900/40 to-background/80'
    : 'from-purple-900/60 via-pink-900/40 to-background/80'

  const glowColor = currentMedia.type === 'PODCAST'
    ? 'shadow-emerald-500/30' : currentMedia.type === 'AUDIOBOOK'
    ? 'shadow-amber-500/30' : 'shadow-purple-500/30'

  return (
    <div className={cn(
      "relative w-full h-full flex items-center justify-center",
      "bg-gradient-to-br",
      bgGradient
    )}>
      <FloatingParticles isPlaying={isPlaying} />

      {/* Pulsing glow behind album art */}
      <div
        className={cn(
          "absolute w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full",
          "bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-rose-500/20",
          "blur-2xl",
          isPlaying && "animate-pulse"
        )}
      />

      {/* Album art */}
      <div
        className={cn(
          "relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden",
          "shadow-2xl",
          glowColor,
          "ring-2 ring-white/10",
          "transition-shadow duration-500",
          isPlaying && "shadow-[0_0_60px_rgba(168,85,247,0.3)]"
        )}
      >
        {currentMedia.thumbnail ? (
          <img
            src={currentMedia.thumbnail}
            alt={currentMedia.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center">
            <TypeIconComponent className="h-16 w-16 text-white/80" />
          </div>
        )}

        {/* Shimmer overlay when playing */}
        {isPlaying && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
        )}
      </div>

      {/* Floating genre/artist tags */}
      {isPlaying && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <Badge
            variant="outline"
            className="bg-black/30 backdrop-blur-md text-white/60 border-white/10 text-[10px]"
          >
            {currentMedia.artist || currentMedia.channel || currentMedia.genre || 'Now Playing'}
          </Badge>
        </div>
      )}
    </div>
  )
}

// --- Mode 3: Song Relationship Map ---

function SongRelationshipMap({
  currentMedia,
  onNavigate,
}: {
  currentMedia: MediaItem
  onNavigate: (item: MediaItem) => void
}) {
  const audioQueue = useAppStore((s) => s.audioQueue)
  const mediaItems = useAppStore((s) => s.mediaItems)

  // Build relationship nodes
  const relationships = useMemo(() => {
    const nodes: { label: string; type: string; items: MediaItem[] }[] = []

    // Same artist
    if (currentMedia.artist) {
      const sameArtist = mediaItems.filter(
        (m) => m.artist === currentMedia.artist && m.id !== currentMedia.id
      ).slice(0, 4)
      if (sameArtist.length > 0) {
        nodes.push({ label: currentMedia.artist, type: 'artist', items: sameArtist })
      }
    }

    // Same album (from queue)
    const sameAlbum = audioQueue.filter(
      (m) => m.parentId === currentMedia.parentId && m.id !== currentMedia.id
    ).slice(0, 4)
    if (sameAlbum.length > 0) {
      nodes.push({ label: 'Same Album', type: 'album', items: sameAlbum })
    }

    // Same genre
    if (currentMedia.genre) {
      const sameGenre = mediaItems.filter(
        (m) => m.genre === currentMedia.genre && m.id !== currentMedia.id && m.type === currentMedia.type
      ).slice(0, 4)
      if (sameGenre.length > 0) {
        nodes.push({ label: currentMedia.genre, type: 'genre', items: sameGenre })
      }
    }

    // Fill with queue items if not enough relationships
    if (nodes.length === 0) {
      const queueItems = audioQueue.filter((m) => m.id !== currentMedia.id).slice(0, 4)
      if (queueItems.length > 0) {
        nodes.push({ label: 'In Queue', type: 'queue', items: queueItems })
      }
    }

    return nodes
  }, [currentMedia, audioQueue, mediaItems])

  const nodeColors: Record<string, string> = {
    artist: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    album: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    genre: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    queue: 'bg-rose-500/20 border-rose-500/30 text-rose-300',
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-background/90 via-background/70 to-background/90 overflow-hidden">
      <FloatingParticles isPlaying={true} />

      {/* Central node - current song */}
      <div className="relative z-10 flex flex-col items-center">
        <div className={cn(
          "w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden",
          "ring-3 ring-purple-500/30 shadow-xl shadow-purple-500/20",
          "bg-gradient-to-br from-purple-500/30 to-pink-500/30"
        )}>
          {currentMedia.thumbnail ? (
            <img src={currentMedia.thumbnail} alt={currentMedia.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-8 w-8 text-white/60" />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-center max-w-[120px] truncate">{currentMedia.title}</p>
      </div>

      {/* Radial relationship nodes */}
      {relationships.map((node, i) => {
        const angle = (i / Math.max(relationships.length, 1)) * 2 * Math.PI - Math.PI / 2
        const radius = 120
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius

        return (
          <div
            key={node.label}
            className="absolute z-10"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Connection line (CSS) */}
            <div
              className="absolute bg-white/5"
              style={{
                width: '2px',
                height: `${radius}px`,
                left: '50%',
                top: '50%',
                transformOrigin: 'top center',
                transform: `rotate(${angle + Math.PI / 2}rad) translateX(-50%)`,
              }}
            />

            <div className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl border",
              "backdrop-blur-sm",
              nodeColors[node.type] || nodeColors.queue
            )}>
              <span className="text-[10px] font-medium">{node.label}</span>
              <div className="flex gap-1">
                {node.items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item)}
                    className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-white/30 transition-all cursor-pointer"
                  >
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Music className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {relationships.length === 0 && (
        <p className="absolute bottom-4 text-[10px] text-muted-foreground/40">
          Play more music to discover relationships
        </p>
      )}
    </div>
  )
}

// --- Mode 4: Artist Timeline ---

function ArtistTimeline({ currentMedia }: { currentMedia: MediaItem }) {
  const mediaItems = useAppStore((s) => s.mediaItems)

  // Build a timeline of items from the same artist or type
  const timeline = useMemo(() => {
    if (!currentMedia.artist && !currentMedia.channel) return []

    const artistItems = mediaItems
      .filter((m) =>
        (m.artist === currentMedia.artist || m.channel === currentMedia.channel) &&
        m.id !== currentMedia.id &&
        m.releaseYear > 0
      )
      .sort((a, b) => a.releaseYear - b.releaseYear)

    return artistItems
  }, [currentMedia, mediaItems])

  // Add current item to the timeline
  const allItems = useMemo(() => {
    const items = [...timeline]
    if (currentMedia.releaseYear > 0) {
      items.push(currentMedia)
    }
    return items.sort((a, b) => a.releaseYear - b.releaseYear)
  }, [timeline, currentMedia])

  if (allItems.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-background/90 via-background/70 to-background/90">
        <Clock className="h-8 w-8 text-muted-foreground/20 mb-2" />
        <p className="text-xs text-muted-foreground/40">No timeline data available for this artist</p>
      </div>
    )
  }

  const minYear = Math.min(...allItems.map((i) => i.releaseYear))
  const maxYear = Math.max(...allItems.map((i) => i.releaseYear))
  const yearRange = maxYear - minYear || 1

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-background/90 via-background/70 to-background/90 p-4 overflow-hidden">
      {/* Artist Name */}
      <div className="text-center mb-4 shrink-0">
        <p className="text-sm font-semibold text-muted-foreground/60">
          {currentMedia.artist || currentMedia.channel || 'Unknown Artist'}
        </p>
        <p className="text-[10px] text-muted-foreground/30">
          {allItems.length} track{allItems.length !== 1 ? 's' : ''} in library
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 relative">
        {/* Horizontal timeline line */}
        <div className="absolute left-4 right-4 top-1/2 h-px bg-white/10" />

        {/* Year markers */}
        <div className="absolute left-4 right-4 top-1/2 flex justify-between -translate-y-1/2">
          <span className="text-[9px] text-muted-foreground/30 -mt-5">{minYear}</span>
          <span className="text-[9px] text-muted-foreground/30 -mt-5">
            {Math.round(minYear + yearRange / 2)}
          </span>
          <span className="text-[9px] text-muted-foreground/30 -mt-5">{maxYear}</span>
        </div>

        {/* Album/Track markers */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 flex items-center">
          {allItems.map((item) => {
            const position = ((item.releaseYear - minYear) / yearRange) * 100
            const isCurrent = item.id === currentMedia.id

            return (
              <div
                key={item.id}
                className="absolute flex flex-col items-center"
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              >
                {/* Cover thumbnail */}
                <div
                  className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden ring-1",
                    isCurrent
                      ? "ring-purple-400 shadow-lg shadow-purple-500/30"
                      : "ring-white/10"
                  )}
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Year label */}
                <span className={cn(
                  "text-[9px] mt-1",
                  isCurrent ? "text-purple-300 font-semibold" : "text-muted-foreground/40"
                )}>
                  {item.releaseYear}
                </span>

                {/* Now playing indicator */}
                {isCurrent && (
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1 py-0 h-4 bg-purple-500/15 text-purple-300 border-purple-500/20 mt-0.5"
                  >
                    Now
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- Main VisualMusicExperience Component ---

export function VisualMusicExperience({
  currentMedia,
  audioElement,
  isPlaying,
}: VisualMusicExperienceProps) {
  const [activeMode, setActiveMode] = useState<VisualMode>('visualizer')
  const setCurrentMedia = useAppStore((s) => s.setCurrentMedia)

  const modes: { id: VisualMode; icon: React.ElementType; label: string }[] = [
    { id: 'visualizer', icon: Activity, label: 'Visualizer' },
    { id: 'album_art', icon: Image, label: 'Album Art' },
    { id: 'relationship', icon: Network, label: 'Relationships' },
    { id: 'timeline', icon: Clock, label: 'Timeline' },
  ]

  const handleNavigate = useCallback((item: MediaItem) => {
    setCurrentMedia(item)
  }, [setCurrentMedia])

  return (
    <div className="relative w-full max-w-lg aspect-square mb-6">
      {/* Visual Content Area */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {activeMode === 'visualizer' && (
          <EnhancedVisualizerMode
            currentMedia={currentMedia}
            audioElement={audioElement}
            isPlaying={isPlaying}
          />
        )}
        {activeMode === 'album_art' && (
          <AnimatedAlbumArtMode
            currentMedia={currentMedia}
            isPlaying={isPlaying}
          />
        )}
        {activeMode === 'relationship' && (
          <SongRelationshipMap
            currentMedia={currentMedia}
            onNavigate={handleNavigate}
          />
        )}
        {activeMode === 'timeline' && (
          <ArtistTimeline currentMedia={currentMedia} />
        )}

        {/* Gradient overlay at bottom for mode toggle readability */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
      </div>

      {/* Gradient overlay for the album art mode */}
      {activeMode !== 'visualizer' && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/60 rounded-2xl pointer-events-none" />
      )}

      {/* Album art overlay for visualizer mode (spinning disc) */}
      {activeMode === 'visualizer' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background/80 rounded-2xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div
                className={cn(
                  'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10',
                  isPlaying && 'animate-spin'
                )}
                style={{ animationDuration: '8s' }}
              >
                {currentMedia.thumbnail ? (
                  <img
                    src={currentMedia.thumbnail}
                    alt={currentMedia.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center">
                    {(() => {
                      const Icon = typeIconMap[currentMedia.type] || Music
                      return <Icon className="h-16 w-16 text-white/80" />
                    })()}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-background/80 ring-2 ring-white/20" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mode Toggle Row */}
      <div className="absolute bottom-3 left-3 right-3 z-10">
        <div className="flex items-center justify-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2 py-1.5 border border-white/10">
          {modes.map((mode) => {
            const Icon = mode.icon
            const isActive = activeMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200",
                  "text-[10px] font-medium cursor-pointer",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                )}
                title={mode.label}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
