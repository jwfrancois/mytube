'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Eye,
  Calendar,
  Server,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Mic,
  BookOpen,
  Music,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Settings2,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  Film,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import Hls from 'hls.js'
import { useToast } from '@/hooks/use-toast'

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

type StreamMode = 'hls' | 'transcode' | 'direct' | 'loading' | 'error'

const EQ_PRESETS = [
  { id: 'flat', label: 'Flat', bass: 0, treble: 0 },
  { id: 'bass-boost', label: 'Bass Boost', bass: 6, treble: 0 },
  { id: 'treble-boost', label: 'Treble Boost', bass: 0, treble: 5 },
  { id: 'v-shape', label: 'V-Shape', bass: 4, treble: 4 },
  { id: 'vocal', label: 'Vocal', bass: -2, treble: 3 },
  { id: 'podcast', label: 'Podcast', bass: 2, treble: 3 },
  { id: 'bass-heavy', label: 'Bass Heavy', bass: 8, treble: -2 },
  { id: 'warm', label: 'Warm', bass: 3, treble: -1 },
]

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function AudioPlayer() {
  const {
    currentMedia, setCurrentMedia, mediaItems, jellyfinItems,
    playQueue, queueIndex, repeatMode, setRepeatMode, shuffleMode, setShuffleMode,
    playNext, playPrevious, playQueueItem,
    playbackSpeed, setPlaybackSpeed,
    eqPreset, setEqPreset, bassBoost, setBassBoost, trebleBoost, setTrebleBoost,
    setMiniPlayerMode, setAudioElementRef,
  } = useAppStore()

  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [streamMode, setStreamMode] = useState<StreamMode>('loading')
  const retryCountRef = useRef(0)
  const { toast } = useToast()

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const currentItemIdRef = useRef<string | null>(null)

  // Audio Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [visualizerStyle, setVisualizerStyle] = useState<'bars' | 'wave' | 'circular'>('bars')

  // UI State
  const [showQueue, setShowQueue] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Register audio element in store for MiniPlayer access
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      useAppStore.getState().setAudioElementRef(video as any)
    }
    return () => {
      useAppStore.getState().setAudioElementRef(null)
    }
  }, [currentMedia?.id])

  const isJellyfin = currentMedia?.isJellyfin ?? false
  const isPodcast = currentMedia?.type === 'PODCAST'
  const isAudiobook = currentMedia?.type === 'AUDIOBOOK'
  const isMusic = currentMedia?.type === 'MUSIC'

  // Volume control
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = isMuted ? 0 : volume
      video.muted = isMuted
    }
  }, [volume, isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = 1
      video.muted = false
    }
  }, [])

  // Playback speed
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  const attemptPlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      video.muted = false
      video.volume = isMuted ? 0 : volume
      video.playbackRate = playbackSpeed
      await video.play()
      setIsVideoPlaying(true)
    } catch {
      try {
        video.muted = true
        setIsMuted(true)
        await video.play()
        setIsVideoPlaying(true)
      } catch {
        setIsVideoPlaying(false)
      }
    }
  }, [isMuted, volume, playbackSpeed])

  // Setup Audio Context and Visualizer
  const setupVisualizer = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    try {
      if (!audioContextRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = ctx
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = ctx.createMediaElementSource(video)
        sourceRef.current = source
        source.connect(analyser)
        analyser.connect(ctx.destination)
      }
    } catch (err) {
      console.error('Audio visualizer setup failed:', err)
    }
  }, [])

  // Draw visualizer
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const WIDTH = canvas.width
    const HEIGHT = canvas.height

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, WIDTH, HEIGHT)

      if (visualizerStyle === 'bars') {
        const barWidth = (WIDTH / bufferLength) * 2.5
        let x = 0
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8
          const hue = (i / bufferLength) * 60 + 240 // Purple to blue range
          const alpha = 0.6 + (dataArray[i] / 255) * 0.4

          const gradient = ctx.createLinearGradient(x, HEIGHT - barHeight, x, HEIGHT)
          gradient.addColorStop(0, `hsla(${hue}, 80%, 65%, ${alpha})`)
          gradient.addColorStop(1, `hsla(${hue}, 80%, 45%, ${alpha * 0.5})`)

          ctx.fillStyle = gradient
          ctx.fillRect(x, HEIGHT - barHeight, barWidth - 1, barHeight)

          // Glow effect
          ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.3)`
          ctx.shadowBlur = 8
          ctx.fillRect(x, HEIGHT - barHeight, barWidth - 1, 2)
          ctx.shadowBlur = 0

          x += barWidth
        }
      } else if (visualizerStyle === 'wave') {
        analyser.getByteTimeDomainData(dataArray)
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)'
        ctx.beginPath()

        const sliceWidth = WIDTH / bufferLength
        let x = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * HEIGHT) / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(WIDTH, HEIGHT / 2)
        ctx.stroke()

        // Second wave (offset)
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
        ctx.beginPath()
        x = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * HEIGHT) / 2 + 4
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(WIDTH, HEIGHT / 2)
        ctx.stroke()
      } else if (visualizerStyle === 'circular') {
        const centerX = WIDTH / 2
        const centerY = HEIGHT / 2
        const radius = Math.min(WIDTH, HEIGHT) * 0.25

        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2
          const barHeight = (dataArray[i] / 255) * radius * 0.8
          const hue = (i / bufferLength) * 60 + 240

          const x1 = centerX + Math.cos(angle) * radius
          const y1 = centerY + Math.sin(angle) * radius
          const x2 = centerX + Math.cos(angle) * (radius + barHeight)
          const y2 = centerY + Math.sin(angle) * (radius + barHeight)

          ctx.lineWidth = 3
          ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${0.4 + (dataArray[i] / 255) * 0.6})`
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }

        // Center glow
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.8)
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0.15)')
        gradient.addColorStop(1, 'rgba(168, 85, 247, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
      }
    }

    draw()
  }, [visualizerStyle])

  // Start/stop visualizer animation
  useEffect(() => {
    if (isVideoPlaying && analyserRef.current) {
      drawVisualizer()
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [isVideoPlaying, drawVisualizer])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const container = canvas.parentElement
    if (!container) return

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Auto-advance when track ends
  const handleTrackEnd = useCallback(() => {
    const { playQueue, queueIndex, repeatMode } = useAppStore.getState()
    if (repeatMode === 'one') {
      // Replay current track
      const video = videoRef.current
      if (video) {
        video.currentTime = 0
        video.play().catch(() => {})
      }
      return
    }

    if (queueIndex < playQueue.length - 1 || repeatMode === 'all') {
      playNext()
    } else {
      setIsVideoPlaying(false)
    }
  }, [playNext])

  // Initialize playback when media changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentMedia) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    currentItemIdRef.current = currentMedia.id
    retryCountRef.current = 0

    const itemId = currentMedia.jellyfinId
    const jellyfin = currentMedia.isJellyfin ?? false

    if (!jellyfin || !itemId) {
      if (currentMedia.videoUrl) {
        video.src = currentMedia.videoUrl
        video.volume = isMuted ? 0 : volume
        video.muted = isMuted
        video.playbackRate = playbackSpeed
        video.load()
        attemptPlay(video)
      }
      setStreamMode('direct')
      return
    }

    setVideoError(null)
    setVideoLoading(true)
    setIsVideoPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setStreamMode('loading')

    video.muted = false
    video.volume = 1

    // Use smart mode which detects audio codec and chooses optimal streaming
    // Smart mode will: use direct play for browser-compatible codecs (AAC, MP3, Opus),
    // or transcode to MP3 for incompatible codecs
    const startSmart = () => {
      video.src = `/api/jellyfin/stream/${itemId}?mediaType=audio&mode=smart`
      video.volume = isMuted ? 0 : volume
      video.muted = isMuted
      video.playbackRate = playbackSpeed
      video.load()
      setStreamMode('direct')
      attemptPlay(video)
    }

    startSmart()

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [currentMedia?.id])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onError = () => {
      const error = video.error
      if (!error) {
        setVideoError('Failed to load the media.')
        setStreamMode('error')
        setVideoLoading(false)
        return
      }

      const currentRetry = retryCountRef.current
      const itemId = currentMedia?.jellyfinId

      if (currentRetry < 2 && isJellyfin && itemId) {
        retryCountRef.current = currentRetry + 1
        toast({ title: 'Playback error - trying alternative format' })
        if (streamMode === 'direct') {
          video.src = `/api/jellyfin/stream/${itemId}?mediaType=audio&mode=transcode`
          video.volume = isMuted ? 0 : volume
          video.muted = isMuted
          video.playbackRate = playbackSpeed
          video.load()
          setStreamMode('transcode')
          attemptPlay(video)
          return
        } else {
          video.src = `/api/jellyfin/stream/${itemId}?mediaType=audio&mode=smart`
          video.volume = isMuted ? 0 : volume
          video.muted = isMuted
          video.playbackRate = playbackSpeed
          video.load()
          setStreamMode('direct')
          attemptPlay(video)
          return
        }
      }

      setVideoError('Playback error. Try another format.')
      setStreamMode('error')
      setVideoLoading(false)
    }

    const onCanPlay = () => {
      setVideoLoading(false)
      setVideoError(null)
      // Setup visualizer on first play
      if (!audioContextRef.current) {
        setupVisualizer()
      }
    }

    const onEnded = () => {
      handleTrackEnd()
    }

    const onWaiting = () => setVideoLoading(true)
    const onPlaying = () => { setVideoLoading(false); setIsVideoPlaying(true) }
    const onPlay = () => setIsVideoPlaying(true)
    const onPause = () => setIsVideoPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.duration && isFinite(video.duration)) setDuration(video.duration)
    }
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) setDuration(video.duration)
    }

    video.addEventListener('error', onError)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('loadeddata', onCanPlay)
    video.addEventListener('ended', onEnded)

    return () => {
      video.removeEventListener('error', onError)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('loadeddata', onCanPlay)
      video.removeEventListener('ended', onEnded)
    }
  }, [currentMedia?.id, isJellyfin, streamMode, volume, isMuted, attemptPlay, setupVisualizer, handleTrackEnd, playbackSpeed])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          if (video.paused) video.play().catch(() => {})
          else video.pause()
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.currentTime + 10, video.duration || 0)
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(video.currentTime - 10, 0)
          break
        case 'm':
          e.preventDefault()
          setIsMuted(prev => !prev)
          break
        case 'n':
          e.preventDefault()
          playNext()
          break
        case 'p':
          e.preventDefault()
          playPrevious()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playNext, playPrevious])

  if (!currentMedia) return null

  const handleBack = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    // Clean up audio context
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setCurrentMedia(null)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.muted && isMuted) {
        video.muted = false
        setIsMuted(false)
        video.volume = volume
      }
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video || !duration) return
    video.currentTime = (value[0] / 100) * duration
    setCurrentTime((value[0] / 100) * duration)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const typeColorMap: Record<string, string> = {
    MUSIC: 'bg-purple-500/10 text-purple-500',
    PODCAST: 'bg-orange-500/10 text-orange-500',
    AUDIOBOOK: 'bg-amber-500/10 text-amber-500',
  }
  const typeColor = typeColorMap[currentMedia.type] || ''

  const typeLabelMap: Record<string, string> = {
    MUSIC: 'Music',
    PODCAST: 'Podcast',
    AUDIOBOOK: 'Audiobook',
  }

  const getTypeIcon = () => {
    switch (currentMedia.type) {
      case 'PODCAST': return <Mic className="h-4 w-4" />
      case 'AUDIOBOOK': return <BookOpen className="h-4 w-4" />
      default: return <Music className="h-4 w-4" />
    }
  }

  const getEpisodeInfo = () => {
    if (isPodcast && currentMedia.indexNumber) return `Episode ${currentMedia.indexNumber}`
    if (isAudiobook && currentMedia.indexNumber) return `Chapter ${currentMedia.indexNumber}`
    return null
  }

  // Get gradient colors based on type
  const gradientColors = isPodcast
    ? 'from-orange-500/20 via-red-500/10 to-orange-500/5'
    : isAudiobook
    ? 'from-amber-500/20 via-orange-500/10 to-amber-500/5'
    : 'from-purple-500/20 via-pink-500/10 to-purple-500/5'

  const accentColor = isPodcast ? 'orange' : isAudiobook ? 'amber' : 'purple'

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">
      {/* Main Audio Player Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 lg:p-6 flex flex-col items-center">
          {/* Back + Minimize buttons */}
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMiniPlayerMode(true)}
                className="gap-1"
                aria-label="Minimize player"
              >
                <ChevronDown className="h-4 w-4" />
                <span className="hidden sm:inline">Minimize</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isJellyfin && streamMode !== 'loading' && streamMode !== 'error' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  {streamMode === 'direct' ? 'Direct' : 'Transcode'}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="gap-1">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Sound</span>
              </Button>
            </div>
          </div>

          {/* Album Art / Visualizer */}
          <div className={cn(
            "relative w-full max-w-md aspect-square rounded-2xl overflow-hidden mb-6 shadow-2xl",
            `bg-gradient-to-br ${gradientColors}`
          )}>
            {/* Canvas Visualizer (background) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ opacity: isVideoPlaying ? 0.6 : 0 }}
            />

            {/* Album Art Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn(
                "w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500",
                isVideoPlaying && "scale-105"
              )}>
                {currentMedia.thumbnail ? (
                  <img
                    src={currentMedia.thumbnail}
                    alt={currentMedia.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center",
                    isPodcast ? "bg-gradient-to-br from-orange-500 to-red-600" :
                    isAudiobook ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                    "bg-gradient-to-br from-purple-500 to-pink-600"
                  )}>
                    <span className="text-6xl">
                      {isPodcast ? '🎙️' : isAudiobook ? '📚' : '🎵'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Loading overlay */}
            {videoLoading && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
            )}

            {/* Error overlay */}
            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-white text-sm">{videoError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setVideoError(null)
                      setVideoLoading(true)
                      retryCountRef.current = 0
                      const video = videoRef.current
                      if (!video || !isJellyfin || !currentMedia.jellyfinId) return
                      video.src = `/api/jellyfin/stream/${currentMedia.jellyfinId}?mediaType=audio&mode=smart`
                      video.volume = 1
                      video.muted = false
                      video.playbackRate = playbackSpeed
                      video.load()
                      setStreamMode('transcode')
                      attemptPlay(video)
                    }}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Visualizer style selector */}
            <div className="absolute bottom-3 right-3 flex gap-1">
              {(['bars', 'wave', 'circular'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setVisualizerStyle(style)}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-all",
                    visualizerStyle === style
                      ? "bg-white text-black"
                      : "bg-black/40 text-white/70 hover:bg-black/60"
                  )}
                >
                  {style === 'bars' ? '☰' : style === 'wave' ? '〜' : '◎'}
                </button>
              ))}
            </div>
          </div>

          {/* Track Info */}
          <div className="w-full text-center mb-4">
            {getEpisodeInfo() && (
              <p className="text-xs text-muted-foreground mb-1">{getEpisodeInfo()}</p>
            )}
            <h1 className="text-xl font-bold leading-tight">{currentMedia.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {currentMedia.artist || currentMedia.channel}
              {currentMedia.releaseYear > 0 && ` • ${currentMedia.releaseYear}`}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full mb-4 group/progress">
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 [&_[role=slider]]:group-hover/progress:opacity-100 [&_.relative]:h-1.5 [&_.relative]:group-hover/progress:h-2 [&_[data-orientation=horizontal]>.bg-primary]:bg-purple-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6">
            {/* Shuffle */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-10 w-10", shuffleMode === 'on' && `text-${accentColor}-500`)}
              onClick={() => setShuffleMode(shuffleMode === 'on' ? 'off' : 'on')}
            >
              <Shuffle className="h-4 w-4" />
            </Button>

            {/* Previous */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={playPrevious}
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105",
                isPodcast ? "bg-orange-500 hover:bg-orange-600" :
                isAudiobook ? "bg-amber-500 hover:bg-amber-600" :
                "bg-purple-500 hover:bg-purple-600"
              )}
            >
              {isVideoPlaying ? (
                <Pause className="h-6 w-6 text-white fill-white" />
              ) : (
                <Play className="h-6 w-6 text-white fill-white ml-0.5" />
              )}
            </button>

            {/* Next */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={playNext}
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            {/* Repeat */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-10 w-10", repeatMode !== 'none' && `text-${accentColor}-500`)}
              onClick={() => setRepeatMode(
                repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none'
              )}
            >
              {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          {/* Volume + Speed row */}
          <div className="w-full flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setIsMuted(prev => !prev)}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={(val) => {
                  const newVol = val[0] / 100
                  setVolume(newVol)
                  if (newVol > 0) {
                    setIsMuted(false)
                    const video = videoRef.current
                    if (video) { video.muted = false; video.volume = newVol }
                  }
                }}
                className="[&_.relative]:h-1 [&_[data-orientation=horizontal]>.bg-primary]:bg-purple-500"
              />
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-1">
              {SPEED_OPTIONS.map(speed => (
                <button
                  key={speed}
                  onClick={() => {
                    setPlaybackSpeed(speed)
                    const video = videoRef.current
                    if (video) video.playbackRate = speed
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                    playbackSpeed === speed
                      ? "bg-purple-500 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
              className={cn("gap-1", liked && "bg-primary text-primary-foreground")}
              onClick={() => { setLiked(!liked); setDisliked(false) }}
            >
              <ThumbsUp className="h-4 w-4" />
              {liked ? 'Liked' : 'Like'}
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
              Share
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={cn("gap-1", showQueue && "bg-primary text-primary-foreground")}
              onClick={() => setShowQueue(!showQueue)}
            >
              <ListMusic className="h-4 w-4" />
              Queue
              {playQueue.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{playQueue.length}</Badge>
              )}
            </Button>
          </div>

          {/* Sound Settings Panel */}
          {showSettings && (
            <div className="w-full border border-border rounded-xl p-4 mb-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Sound Settings
              </h3>

              {/* EQ Presets */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Equalizer Preset</p>
                <div className="flex flex-wrap gap-1.5">
                  {EQ_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setEqPreset(preset.id)
                        setBassBoost(preset.bass)
                        setTrebleBoost(preset.treble)
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        eqPreset === preset.id
                          ? "bg-purple-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bass Boost */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Bass</p>
                  <span className="text-xs font-medium">{bassBoost > 0 ? `+${bassBoost}` : bassBoost} dB</span>
                </div>
                <Slider
                  value={[bassBoost + 10]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={(val) => setBassBoost(val[0] - 10)}
                  className="[&_.relative]:h-2 [&_[data-orientation=horizontal]>.bg-primary]:bg-orange-500"
                />
              </div>

              {/* Treble Boost */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Treble</p>
                  <span className="text-xs font-medium">{trebleBoost > 0 ? `+${trebleBoost}` : trebleBoost} dB</span>
                </div>
                <Slider
                  value={[trebleBoost + 10]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={(val) => setTrebleBoost(val[0] - 10)}
                  className="[&_.relative]:h-2 [&_[data-orientation=horizontal]>.bg-primary]:bg-blue-500"
                />
              </div>
            </div>
          )}

          {/* Hidden audio element */}
          <audio
            ref={videoRef as any}
            preload="auto"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Queue Sidebar */}
      {showQueue && (
        <div className="w-full lg:w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ListMusic className="h-4 w-4" />
              Play Queue
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQueue(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Now Playing */}
          {currentMedia && (
            <div className="p-3 border-b border-border bg-muted/30">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Now Playing</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  {currentMedia.thumbnail ? (
                    <img src={currentMedia.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={cn(
                      "w-full h-full flex items-center justify-center",
                      isPodcast ? "bg-gradient-to-br from-orange-500 to-red-500" :
                      isAudiobook ? "bg-gradient-to-br from-amber-500 to-orange-500" :
                      "bg-gradient-to-br from-purple-500 to-pink-500"
                    )}>
                      {getTypeIcon()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentMedia.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentMedia.artist || currentMedia.channel}</p>
                </div>
                {isVideoPlaying && (
                  <div className="flex items-center gap-0.5">
                    <div className="w-0.5 h-3 bg-purple-500 animate-pulse rounded-full" />
                    <div className="w-0.5 h-4 bg-purple-500 animate-pulse rounded-full" style={{ animationDelay: '0.1s' }} />
                    <div className="w-0.5 h-2 bg-purple-500 animate-pulse rounded-full" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Queue List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {playQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <ListMusic className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Queue is empty</p>
                  <p className="text-xs mt-1">Play an album or podcast to fill the queue</p>
                </div>
              ) : (
                playQueue.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                      index === queueIndex ? "bg-muted" : "hover:bg-muted/50"
                    )}
                    onClick={() => playQueueItem(index)}
                  >
                    <span className="w-6 text-xs text-muted-foreground text-center shrink-0">
                      {index === queueIndex && isVideoPlaying ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-0.5 h-2.5 bg-purple-500 animate-pulse rounded-full" />
                          <div className="w-0.5 h-3.5 bg-purple-500 animate-pulse rounded-full" style={{ animationDelay: '0.1s' }} />
                          <div className="w-0.5 h-1.5 bg-purple-500 animate-pulse rounded-full" style={{ animationDelay: '0.2s' }} />
                        </div>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="w-8 h-8 rounded overflow-hidden shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Music className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs truncate", index === queueIndex && "font-medium text-purple-500")}>
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.artist || item.channel}
                      </p>
                    </div>
                    {item.duration && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{item.duration}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Queue Controls */}
          {playQueue.length > 0 && (
            <div className="p-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", repeatMode !== 'none' && "text-purple-500")}
                  onClick={() => setRepeatMode(
                    repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none'
                  )}
                >
                  {repeatMode === 'one' ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", shuffleMode === 'on' && "text-purple-500")}
                  onClick={() => setShuffleMode(shuffleMode === 'on' ? 'off' : 'on')}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {queueIndex + 1} / {playQueue.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
