'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { SoundSettings } from '@/components/SoundSettings'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Settings2,
  X,
  Music,
  Podcast,
  BookOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isAudioType(type: string): boolean {
  return ['MUSIC', 'PODCAST', 'AUDIOBOOK'].includes(type)
}

// Map of icon components by type
const typeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PODCAST: Podcast,
  AUDIOBOOK: BookOpen,
  MUSIC: Music,
}

// ─── Queue Item ─────────────────────────────────────────────────────────────

function QueueItem({
  item,
  index,
  isActive,
  onPlay,
  onRemove,
}: {
  item: MediaItem
  index: number
  isActive: boolean
  onPlay: () => void
  onRemove: () => void
}) {
  const IconComponent = typeIconMap[item.type] || Music

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      onClick={onPlay}
    >
      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
        {isActive ? '▶' : index + 1}
      </span>
      <div className="relative w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <IconComponent className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isActive && 'text-primary font-medium')}>
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.artist || item.channel || ''}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{item.duration}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main AudioPlayerBar ────────────────────────────────────────────────────

export function AudioPlayerBar() {
  const {
    currentMedia,
    isPlaying,
    setIsPlaying,
    audioQueue,
    audioQueueIndex,
    playNext,
    playPrevious,
    removeFromAudioQueue,
    clearAudioQueue,
    setAudioQueueIndex,
    volume,
    setVolume,
    shuffleEnabled,
    setShuffleEnabled,
    repeatMode,
    setRepeatMode,
    setCurrentMedia,
  } = useAppStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  // Store the audio element in state for passing to child components
  // (only set once, when the ref becomes available)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  // Determine if we should show the bar
  const isAudio = currentMedia ? isAudioType(currentMedia.type) : false

  // Sync the audio element ref to state (for passing to SoundSettings)
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current)
    }
  }, [audioElement])

  // Build the audio URL
  const getAudioSrc = useCallback((media: MediaItem) => {
    if (media.isJellyfin && media.jellyfinId) {
      const streamParams = new URLSearchParams()
      streamParams.set('mediaType', 'audio')
      if (media.mediaSourceId) {
        streamParams.set('mediaSourceId', media.mediaSourceId)
      }
      return `/api/jellyfin/stream/${media.jellyfinId}?${streamParams.toString()}`
    }
    return media.videoUrl
  }, [])

  // Sync audio element with current media
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentMedia || !isAudio) return

    const src = getAudioSrc(currentMedia)
    if (el.src !== src) {
      el.src = src
      el.volume = volume
      el.load()
    }

    if (isPlaying) {
      el.play().catch(() => {})
    }
  }, [currentMedia, isAudio, getAudioSrc, isPlaying, volume])

  // Play/pause sync
  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentMedia || !isAudio) return
    if (isPlaying) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [isPlaying])

  // Volume sync
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
  }, [volume])

  // Audio error handler with auto-retry
  const handleAudioError = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    const error = el.error
    if (error) {
      if (retryCount < 2) {
        // Auto-retry up to 2 times
        setRetryCount(prev => prev + 1)
        setTimeout(() => {
          el.load()
          el.play().catch(() => {})
        }, 1000)
      } else {
        const errorMsg = error.code === MediaError.MEDIA_ERR_NETWORK
          ? 'Network error loading audio.'
          : error.code === MediaError.MEDIA_ERR_DECODE
            ? 'Audio format could not be decoded.'
            : error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
              ? 'Audio format not supported.'
              : 'Failed to load audio.'
        setAudioError(errorMsg)
      }
    }
  }, [retryCount])

  const handleAudioCanPlay = useCallback(() => {
    setAudioError(null)
    setRetryCount(0)
  }, [])

  // Time update handler
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTimeUpdate = () => {
      if (!seeking) {
        setCurrentTime(el.currentTime)
      }
    }
    const onLoadedMetadata = () => {
      setDuration(el.duration)
    }
    const onEnded = () => {
      playNext()
    }
    const onError = () => handleAudioError()
    const onCanPlay = () => handleAudioCanPlay()

    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('durationchange', onLoadedMetadata)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    el.addEventListener('canplay', onCanPlay)

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('durationchange', onLoadedMetadata)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
      el.removeEventListener('canplay', onCanPlay)
    }
  }, [seeking, playNext, handleAudioError, handleAudioCanPlay])

  // Seek handler
  const handleSeek = useCallback(([value]: number[]) => {
    const el = audioRef.current
    if (el) {
      el.currentTime = value
      setCurrentTime(value)
    }
    setSeeking(false)
  }, [])

  // Play/Pause
  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
    } else {
      el.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  // Handle queue item click
  const handleQueueItemPlay = useCallback((index: number) => {
    setAudioQueueIndex(index)
    const item = audioQueue[index]
    if (item) {
      setCurrentMedia(item)
    }
  }, [audioQueue, setAudioQueueIndex, setCurrentMedia])

  const VolumeIconComponent = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  if (!isAudio || !currentMedia) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const RepeatIconComponent = repeatMode === 'one' ? Repeat1 : Repeat

  return (
    <>
      {/* Hidden audio element for continuous playback */}
      <audio ref={audioRef} preload="auto" />

      {/* Player Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        {/* Audio error banner */}
        {audioError && (
          <div className="px-4 py-1.5 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1 truncate">{audioError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAudioError(null)
                setRetryCount(0)
                const el = audioRef.current
                if (el) {
                  el.load()
                  el.play().catch(() => {})
                }
              }}
              className="h-6 px-2 text-xs shrink-0"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        <div className="flex items-center h-20 px-4 gap-4">
          {/* Progress bar (thin line on top) */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted/50 cursor-pointer group"
            onClick={(e) => {
              const el = audioRef.current
              if (!el || duration <= 0) return
              const rect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - rect.left
              const pct = x / rect.width
              el.currentTime = pct * duration
              setCurrentTime(pct * duration)
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-150 group-hover:h-1.5"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center h-full gap-4 w-full">
            {/* Left: Track info */}
            <div className="flex items-center gap-3 min-w-0 w-1/3">
              {/* Spinning disc thumbnail */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full overflow-hidden shadow-lg ring-2 ring-background',
                    isPlaying && 'animate-spin'
                  )}
                  style={{ animationDuration: '3s' }}
                >
                  {currentMedia.thumbnail ? (
                    <img
                      src={currentMedia.thumbnail}
                      alt={currentMedia.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Music className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                {/* Center hole of the disc */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-background" />
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                  {currentMedia.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentMedia.artist || currentMedia.channel || ''}
                </p>
              </div>
            </div>

            {/* Center: Transport controls */}
            <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', shuffleEnabled && 'text-primary')}
                  onClick={() => setShuffleEnabled(!shuffleEnabled)}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => playPrevious()}
                  disabled={audioQueue.length <= 1}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => playNext()}
                  disabled={audioQueue.length <= 1}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', repeatMode !== 'none' && 'text-primary')}
                  onClick={() => {
                    const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one']
                    const currentIdx = modes.indexOf(repeatMode)
                    setRepeatMode(modes[(currentIdx + 1) % modes.length])
                  }}
                >
                  <RepeatIconComponent className="h-4 w-4" />
                </Button>
              </div>

              {/* Time display (hidden on very small screens) */}
              <div className="hidden sm:flex items-center gap-2 w-full max-w-md text-xs text-muted-foreground">
                <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onPointerDown={() => setSeeking(true)}
                  onValueChange={handleSeek}
                  className="flex-1"
                />
                <span className="w-10 tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: Volume, Settings, Queue */}
            <div className="flex items-center gap-1 justify-end w-1/3">
              {/* Volume (hidden on mobile) */}
              <div className="hidden md:flex items-center gap-2 w-32">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                >
                  <VolumeIconComponent className="h-4 w-4" />
                </Button>
                <Slider
                  value={[volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setVolume(v / 100)}
                  className="flex-1"
                />
              </div>

              {/* Sound Settings */}
              <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8', settingsOpen && 'text-primary')}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="top" align="end">
                  <SoundSettings audioElement={audioElement} compact />
                </PopoverContent>
              </Popover>

              {/* Queue */}
              <Drawer open={queueOpen} onOpenChange={setQueueOpen}>
                <DrawerTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8 relative', queueOpen && 'text-primary')}
                  >
                    <ListMusic className="h-4 w-4" />
                    {audioQueue.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px]"
                      >
                        {audioQueue.length}
                      </Badge>
                    )}
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="flex-row items-center justify-between space-y-0 pb-2">
                    <DrawerTitle className="flex items-center gap-2">
                      <ListMusic className="h-4 w-4" />
                      Play Queue
                      <Badge variant="secondary" className="text-xs">
                        {audioQueue.length} tracks
                      </Badge>
                    </DrawerTitle>
                    {audioQueue.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAudioQueue}
                        className="text-xs text-muted-foreground"
                      >
                        Clear All
                      </Button>
                    )}
                  </DrawerHeader>
                  <ScrollArea className="max-h-[50vh]">
                    <div className="px-4 pb-4 space-y-0.5">
                      {audioQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <ListMusic className="h-10 w-10 mb-2 opacity-20" />
                          <p className="text-sm">Queue is empty</p>
                          <p className="text-xs mt-1">Play a track to start the queue</p>
                        </div>
                      ) : (
                        audioQueue.map((item, index) => (
                          <QueueItem
                            key={`${item.id}-${index}`}
                            item={item}
                            index={index}
                            isActive={index === audioQueueIndex}
                            onPlay={() => handleQueueItemPlay(index)}
                            onRemove={() => removeFromAudioQueue(index)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
