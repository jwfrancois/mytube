'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
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
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`
  return `${views}`
}

export function VideoPlayer() {
  const { currentMedia, setCurrentMedia, mediaItems, jellyfinItems } = useAppStore()
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)

  if (!currentMedia) return null

  const isMusic = currentMedia.type === 'MUSIC'
  const isJellyfin = currentMedia.isJellyfin

  // Build the video URL
  let videoSrc = currentMedia.videoUrl
  if (isJellyfin && currentMedia.jellyfinId) {
    const mediaTypeParam = isMusic ? '?mediaType=audio' : ''
    videoSrc = `/api/jellyfin/stream/${currentMedia.jellyfinId}${mediaTypeParam}`
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
  }

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

  // Reset state when media changes
  useEffect(() => {
    setVideoError(null)
    setVideoLoading(true)
    setLiked(false)
    setDisliked(false)
    setIsVideoPlaying(false)
  }, [currentMedia?.id])

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
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
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
                      if (videoRef.current) {
                        videoRef.current.load()
                      }
                    }}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Music overlay for audio content */}
            {isMusic && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center transition-transform duration-1000",
                  isVideoPlaying && "animate-spin",
                )} style={{ animationDuration: '3s' }}>
                  {currentMedia.thumbnail ? (
                    <img
                      src={currentMedia.thumbnail}
                      alt={currentMedia.title}
                      className="w-full h-full rounded-full object-cover shadow-2xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl">
                      <span className="text-4xl">🎵</span>
                    </div>
                  )}
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

            {/* Description */}
            {currentMedia.description && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm leading-relaxed">{currentMedia.description}</p>
              </div>
            )}
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

function RelatedVideoCard({ item }: { item: any }) {
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
              {item.type === 'MUSIC' ? '🎵' : item.type === 'TV_SHOW' ? '📺' : '🎬'}
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
