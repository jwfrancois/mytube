'use client'

import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Share2,
  MoreHorizontal,
  Eye,
  Calendar,
  Server,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  Volume1,
  VolumeX,
  Settings2,
  ListMusic,
  Music,
  Podcast,
  BookOpen,
  X,
} from 'lucide-react'
import { MediaDetail } from '@/components/MediaDetail'
import { AudioVisualizer } from '@/components/AudioVisualizer'
import { SoundSettings } from '@/components/SoundSettings'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`
  return `${views}`
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isAudioType(type: string): boolean {
  return ['MUSIC', 'PODCAST', 'AUDIOBOOK'].includes(type)
}

// Map of icon components by type (declared outside render)
const typeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PODCAST: Podcast,
  AUDIOBOOK: BookOpen,
  MUSIC: Music,
}

// ─── Audio Queue Item ──────────────────────────────────────────────────────

function AudioQueueItem({
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
        'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors group',
        isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
      )}
      onClick={onPlay}
    >
      <span className="text-xs text-muted-foreground w-5 text-right shrink-0 tabular-nums">
        {isActive ? '▶' : index + 1}
      </span>
      <div className="relative w-9 h-9 rounded overflow-hidden bg-muted shrink-0">
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

// ─── Audio Player View ─────────────────────────────────────────────────────

function AudioPlayerView({
  currentMedia,
  videoSrc,
  isJellyfin,
  related,
  handleBack,
}: {
  currentMedia: MediaItem
  videoSrc: string
  isJellyfin: boolean
  related: MediaItem[]
  handleBack: () => void
}) {
  const {
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

  const audioRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [queueVisible, setQueueVisible] = useState(true)
  // Store the audio element in state for passing to child components
  const [audioElement, setAudioElement] = useState<HTMLVideoElement | null>(null)

  const TypeIconComponent = typeIconMap[currentMedia.type] || Music

  // Sync audio element ref to state (for passing to AudioVisualizer and SoundSettings)
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current)
    }
  }, [audioElement])

  // Sync audio source
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (el.src !== videoSrc) {
      el.src = videoSrc
      el.load()
    }
    if (isPlaying) {
      el.play().catch(() => {})
    }
  }, [videoSrc, isPlaying])

  // Volume sync via event listener to avoid ref access issues
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume
  }, [volume])

  // Use event listeners instead of inline handlers to avoid ref issues
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

    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('durationchange', onLoadedMetadata)
    el.addEventListener('ended', onEnded)

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('durationchange', onLoadedMetadata)
      el.removeEventListener('ended', onEnded)
    }
  }, [seeking, playNext])

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

  const handleSeek = useCallback(([value]: number[]) => {
    const el = audioRef.current
    if (el) {
      el.currentTime = value
      setCurrentTime(value)
    }
    setSeeking(false)
  }, [])

  const handleQueueItemPlay = useCallback((index: number) => {
    setAudioQueueIndex(index)
    const item = audioQueue[index]
    if (item) {
      setCurrentMedia(item)
    }
  }, [audioQueue, setAudioQueueIndex, setCurrentMedia])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const VolumeIconComponent = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const typeLabel: Record<string, string> = {
    MUSIC: 'Music',
    PODCAST: 'Podcast',
    AUDIOBOOK: 'Audiobook',
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Hidden video element acting as audio player */}
      <video ref={audioRef} className="hidden" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 lg:p-6">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-3 -ml-2 gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Audio Player Layout */}
          <div className="flex flex-col items-center">
            {/* Visualizer + Album Art */}
            <div className="relative w-full max-w-lg aspect-square mb-6">
              {/* Background visualizer */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-60">
                <AudioVisualizer
                  audioElement={audioElement}
                  isPlaying={isPlaying}
                  colorScheme={
                    currentMedia.type === 'PODCAST' ? 'emerald' :
                    currentMedia.type === 'AUDIOBOOK' ? 'amber' : 'purple'
                  }
                  height={400}
                  className="w-full h-full"
                />
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background/80 rounded-2xl" />

              {/* Album art / Spinning disc */}
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
                        <TypeIconComponent className="h-16 w-16 text-white/80" />
                      </div>
                    )}
                  </div>
                  {/* Center hole */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-background/80 ring-2 ring-white/20" />
                  </div>
                </div>
              </div>
            </div>

            {/* Track Info */}
            <div className="w-full max-w-lg text-center mb-4">
              <h1 className="text-xl font-bold leading-tight">{currentMedia.title}</h1>
              <div className="flex items-center justify-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{currentMedia.artist || currentMedia.channel}</span>
                {currentMedia.releaseYear > 0 && (
                  <>
                    <span>•</span>
                    <span>{currentMedia.releaseYear}</span>
                  </>
                )}
                <Badge variant="secondary" className={cn(
                  "text-xs",
                  currentMedia.type === 'MUSIC' && 'bg-purple-500/10 text-purple-500',
                  currentMedia.type === 'PODCAST' && 'bg-emerald-500/10 text-emerald-500',
                  currentMedia.type === 'AUDIOBOOK' && 'bg-amber-500/10 text-amber-500',
                )}>
                  {typeLabel[currentMedia.type] || currentMedia.type}
                </Badge>
                {isJellyfin && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Server className="h-3 w-3" />
                    Jellyfin
                  </Badge>
                )}
              </div>
            </div>

            {/* Transport Controls */}
            <div className="w-full max-w-lg mb-4">
              {/* Progress bar */}
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
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

              {/* Control buttons */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-9 w-9', shuffleEnabled && 'text-primary')}
                  onClick={() => setShuffleEnabled(!shuffleEnabled)}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => playPrevious()}
                  disabled={audioQueue.length <= 1}
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="h-14 w-14 rounded-full"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6 fill-current" />
                  ) : (
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => playNext()}
                  disabled={audioQueue.length <= 1}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-9 w-9', repeatMode !== 'none' && 'text-primary')}
                  onClick={() => {
                    const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one']
                    const currentIdx = modes.indexOf(repeatMode)
                    setRepeatMode(modes[(currentIdx + 1) % modes.length])
                  }}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="h-4 w-4" />
                  ) : (
                    <Repeat className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Volume + Settings row */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="flex items-center gap-2 w-40">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
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

                <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7', settingsOpen && 'text-primary')}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" side="top" align="center">
                    <SoundSettings audioElement={audioElement} compact />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', queueVisible && 'text-primary')}
                  onClick={() => setQueueVisible(!queueVisible)}
                >
                  <ListMusic className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="secondary"
                size="sm"
                className={cn("gap-1", liked && "bg-primary text-primary-foreground")}
                onClick={() => { setLiked(!liked); setDisliked(false) }}
              >
                <ThumbsUp className="h-4 w-4" />
                <span>{liked ? 'Liked' : 'Like'}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className={cn("gap-1", disliked && "bg-destructive text-destructive-foreground")}
                onClick={() => { setDisliked(!disliked); setLiked(false) }}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" className="gap-1">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>

            {/* Queue (inline, toggleable) */}
            {queueVisible && audioQueue.length > 0 && (
              <div className="w-full max-w-lg mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Queue</h3>
                    <Badge variant="secondary" className="text-xs">
                      {audioQueue.length} tracks
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAudioQueue}
                    className="text-xs text-muted-foreground h-7"
                  >
                    Clear
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-xl p-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {audioQueue.map((item, index) => (
                    <AudioQueueItem
                      key={`${item.id}-${index}`}
                      item={item}
                      index={index}
                      isActive={index === audioQueueIndex}
                      onPlay={() => handleQueueItemPlay(index)}
                      onRemove={() => removeFromAudioQueue(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            <Separator className="w-full max-w-lg mb-6" />

            {/* Channel info */}
            <div className="w-full max-w-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn("bg-muted", isJellyfin && "bg-emerald-500/10 text-emerald-500")}>
                    {isJellyfin ? <Server className="h-5 w-5" /> : (currentMedia.channel?.charAt(0) || currentMedia.artist?.charAt(0) || 'C')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{currentMedia.channel || currentMedia.artist}</p>
                  <p className="text-xs text-muted-foreground">
                    {isJellyfin ? 'Jellyfin NAS' : currentMedia.artist}
                  </p>
                </div>
              </div>
              {isJellyfin && (
                <Badge variant="outline" className="gap-1">
                  <Server className="h-3 w-3" />
                  NAS
                </Badge>
              )}
            </div>
          </div>

          {/* Rich Media Detail Panel */}
          <MediaDetail
            jellyfinId={isJellyfin ? currentMedia.jellyfinId : undefined}
            title={currentMedia.title}
            type={currentMedia.type}
            itemType={currentMedia.itemType}
          />
        </div>
      </div>

      {/* Sidebar: Queue or Related */}
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto shrink-0">
        <div className="p-4">
          {audioQueue.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ListMusic className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Queue</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAudioQueue} className="text-xs h-7">
                  Clear
                </Button>
              </div>
              <div className="space-y-0.5">
                {audioQueue.map((item, index) => (
                  <AudioQueueItem
                    key={`sidebar-${item.id}-${index}`}
                    item={item}
                    index={index}
                    isActive={index === audioQueueIndex}
                    onPlay={() => handleQueueItemPlay(index)}
                    onRemove={() => removeFromAudioQueue(index)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-sm mb-3">Related</h3>
              <div className="space-y-3">
                {related.map((item) => (
                  <RelatedVideoCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main VideoPlayer Component ────────────────────────────────────────────

export function VideoPlayer() {
  const {
    currentMedia,
    setCurrentMedia,
    mediaItems,
    jellyfinItems,
    isPlaying,
    setIsPlaying,
    setAudioQueue,
    addToAudioQueue,
  } = useAppStore()

  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [useTranscode, setUseTranscode] = useState(false)

  // Queue populated flag — avoid re-populating on re-renders
  const queuePopulatedRef = useRef<string | null>(null)

  const handleVideoError = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const error = video.error
    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          setVideoError('Playback was aborted.')
          break
        case MediaError.MEDIA_ERR_NETWORK:
          setVideoError('Network error occurred while loading the video. The server may be unreachable or the file may be too large.')
          break
        case MediaError.MEDIA_ERR_DECODE:
          setVideoError('The video format could not be decoded.')
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          setVideoError('The video format is not supported by your browser.')
          break
        default:
          setVideoError('An unknown error occurred while playing the video.')
      }
    } else {
      setVideoError('Failed to load the video.')
    }
    setVideoLoading(false)
  }, [])

  const handleCanPlay = useCallback(() => {
    setVideoLoading(false)
    setVideoError(null)
  }, [])

  const handleWaiting = useCallback(() => {
    setVideoLoading(true)
  }, [])

  const handlePlaying = useCallback(() => {
    setVideoLoading(false)
    setIsVideoPlaying(true)
  }, [])

  // Track previous media ID to reset state on change
  const prevMediaIdRef = useRef<string | undefined>(undefined)
  if (prevMediaIdRef.current !== currentMedia?.id) {
    prevMediaIdRef.current = currentMedia?.id
    if (currentMedia) {
      setVideoError(null)
      setVideoLoading(true)
      setLiked(false)
      setDisliked(false)
      setIsVideoPlaying(false)
      setUseTranscode(false)
    }
  }

  // Populate audio queue when playing audio content from an album
  useEffect(() => {
    if (!currentMedia) return

    const isAudio = isAudioType(currentMedia.type)
    if (!isAudio) return

    // Avoid re-populating for the same media item
    if (queuePopulatedRef.current === currentMedia.id) return
    queuePopulatedRef.current = currentMedia.id

    // If the item has children (album), fetch its children and populate queue
    const populateQueue = async () => {
      if (currentMedia.isJellyfin && currentMedia.hasChildren && currentMedia.jellyfinId) {
        // It's an album — fetch tracks
        try {
          const res = await fetch(`/api/jellyfin/items?parentId=${currentMedia.jellyfinId}`)
          const data = await res.json()
          const tracks = (data.items || []).filter((item: MediaItem) => isAudioType(item.type))
          if (tracks.length > 0) {
            setAudioQueue(tracks)
            // Find the current item in the tracks
            const currentIdx = tracks.findIndex((t: MediaItem) => t.id === currentMedia.id)
            if (currentIdx >= 0) {
              useAppStore.setState({ audioQueueIndex: currentIdx })
            }
          }
        } catch (err) {
          console.error('Failed to fetch album tracks:', err)
          // Fallback: just add the current item
          setAudioQueue([currentMedia])
        }
      } else {
        // Single track — add to queue (or replace if queue is empty)
        const currentQueue = useAppStore.getState().audioQueue
        if (currentQueue.length === 0) {
          setAudioQueue([currentMedia])
        } else {
          // Check if this item is already in the queue
          const exists = currentQueue.some(item => item.id === currentMedia.id)
          if (!exists) {
            addToAudioQueue(currentMedia)
          }
        }
      }
    }

    populateQueue()
  }, [currentMedia, setAudioQueue, addToAudioQueue])

  if (!currentMedia) return null

  const isAudio = isAudioType(currentMedia.type)
  const isJellyfin = currentMedia.isJellyfin

  // Build the video URL
  let videoSrc = currentMedia.videoUrl
  if (isJellyfin && currentMedia.jellyfinId) {
    const streamParams = new URLSearchParams()
    streamParams.set('mediaType', isAudio ? 'audio' : 'video')
    if (currentMedia.mediaSourceId) {
      streamParams.set('mediaSourceId', currentMedia.mediaSourceId)
    }
    if (useTranscode) {
      streamParams.set('directStream', 'false')
    }
    videoSrc = `/api/jellyfin/stream/${currentMedia.jellyfinId}?${streamParams.toString()}`
  }

  // Combine both local and Jellyfin items for related content
  const allItems = [...mediaItems, ...jellyfinItems]

  // Get related items (same type, different id)
  const related = allItems.filter(
    (m) => m.type === currentMedia.type && m.id !== currentMedia.id
  ).slice(0, 6)

  // If not enough of same type, add from other types
  if (related.length < 6) {
    const others = allItems.filter(
      (m) => m.type !== currentMedia.type && m.id !== currentMedia.id
    ).slice(0, 6 - related.length)
    related.push(...others)
  }

  const handleBack = () => {
    setCurrentMedia(null)
    queuePopulatedRef.current = null
  }

  // ─── Audio Player View ───
  if (isAudio) {
    return (
      <AudioPlayerView
        currentMedia={currentMedia}
        videoSrc={videoSrc}
        isJellyfin={!!isJellyfin}
        related={related}
        handleBack={handleBack}
      />
    )
  }

  // ─── Video Player View (Movies/TV Shows) ───
  const typeColor = {
    MOVIE: 'bg-red-500/10 text-red-500',
    TV_SHOW: 'bg-emerald-500/10 text-emerald-500',
    MUSIC: 'bg-purple-500/10 text-purple-500',
  }[currentMedia.type] || ''

  return (
    <div className={cn("flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]")}>
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-3 -ml-2 gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Video Player */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay
              playsInline
              className="w-full h-full"
              onPlay={() => { setIsVideoPlaying(true); setIsPlaying(true) }}
              onPause={() => { setIsVideoPlaying(false); setIsPlaying(false) }}
              onError={handleVideoError}
              onCanPlay={handleCanPlay}
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              onLoadedData={handleCanPlay}
            />

            {/* Loading overlay */}
            {videoLoading && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                  <span className="text-white text-sm">Loading video...</span>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
                  <AlertCircle className="h-12 w-12 text-red-400" />
                  <h3 className="text-white font-semibold text-lg">Playback Error</h3>
                  <p className="text-gray-300 text-sm">{videoError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setVideoError(null)
                      setVideoLoading(true)
                      if (useTranscode) {
                        // Already tried transcoding, just retry
                        if (videoRef.current) videoRef.current.load()
                      } else {
                        // First try was direct play — try transcoding this time
                        setUseTranscode(true)
                      }
                    }}
                    className="mt-2"
                  >
                    {useTranscode ? 'Retry' : 'Try Transcoding'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold leading-tight">{currentMedia.title}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                  {!isJellyfin && (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>{formatViews(currentMedia.views)} views</span>
                      <span>•</span>
                    </>
                  )}
                  {currentMedia.releaseYear > 0 && (
                    <>
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{currentMedia.releaseYear}</span>
                    </>
                  )}
                  <Badge variant="secondary" className={cn("text-xs ml-1", typeColor)}>
                    {currentMedia.type === 'TV_SHOW' ? 'TV Show' : currentMedia.type.charAt(0) + currentMedia.type.slice(1).toLowerCase()}
                  </Badge>
                  {currentMedia.genre && (
                    <Badge variant="outline" className="text-xs">
                      {currentMedia.genre}
                    </Badge>
                  )}
                  {isJellyfin && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Server className="h-3 w-3" />
                      Jellyfin
                    </Badge>
                  )}
                  {currentMedia.communityRating && (
                    <Badge variant="outline" className="text-xs">
                      ⭐ {currentMedia.communityRating.toFixed(1)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn("gap-1", liked && "bg-primary text-primary-foreground")}
                  onClick={() => { setLiked(!liked); setDisliked(false) }}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span className="hidden sm:inline">{liked ? 'Liked' : 'Like'}</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn("gap-1", disliked && "bg-destructive text-destructive-foreground")}
                  onClick={() => { setDisliked(!disliked); setLiked(false) }}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
                <Button variant="secondary" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Channel info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn("bg-muted", isJellyfin && "bg-emerald-500/10 text-emerald-500")}>
                    {isJellyfin ? <Server className="h-5 w-5" /> : (currentMedia.channel?.charAt(0) || currentMedia.artist?.charAt(0) || 'C')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{currentMedia.channel || currentMedia.artist}</p>
                  <p className="text-xs text-muted-foreground">
                    {isJellyfin ? 'Jellyfin NAS' : currentMedia.artist}
                  </p>
                </div>
              </div>
              {isJellyfin && (
                <Badge variant="outline" className="gap-1">
                  <Server className="h-3 w-3" />
                  NAS
                </Badge>
              )}
            </div>

            <Separator className="my-4" />

            {/* Description (shown for non-Jellyfin items; Jellyfin items use MediaDetail) */}
            {currentMedia.description && !isJellyfin && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm leading-relaxed">{currentMedia.description}</p>
              </div>
            )}

            {/* Rich Media Detail Panel */}
            <MediaDetail
              jellyfinId={isJellyfin ? currentMedia.jellyfinId : undefined}
              title={currentMedia.title}
              type={currentMedia.type}
              itemType={currentMedia.itemType}
            />
          </div>
        </div>
      </div>

      {/* Sidebar - Related Videos */}
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto shrink-0">
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Related</h3>
          <div className="space-y-3">
            {related.map((item) => (
              <RelatedVideoCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Related Video Card ────────────────────────────────────────────────────

function RelatedVideoCard({ item }: { item: MediaItem }) {
  const { setCurrentMedia } = useAppStore()

  const handleClick = () => {
    setCurrentMedia(item)
  }

  return (
    <div
      className="flex gap-2 cursor-pointer group"
      onClick={handleClick}
    >
      <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-2xl">
              {item.type === 'MUSIC' ? '🎵' : item.type === 'TV_SHOW' ? '📺' : item.type === 'PODCAST' ? '🎙️' : item.type === 'AUDIOBOOK' ? '📖' : '🎬'}
            </span>
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
          {item.duration}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {item.channel || item.artist}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.isJellyfin ? 'Jellyfin' : `${formatViews(item.views)} views`} • {item.releaseYear || ''}
        </p>
      </div>
    </div>
  )
}
