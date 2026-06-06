'use client'

import { useAppStore } from '@/store/useAppStore'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Play,
  MoreVertical,
  Clock,
  Eye,
  BookmarkPlus,
  Bookmark,
  Check,
  FolderOpen,
  ChevronRight,
  Server,
  Star,
  Layers,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MediaCardProps {
  item: any
  onWatchLater?: (item: any) => void
  onRemoveWatchLater?: (id: string) => void
  isInWatchLater?: boolean
  onPlay?: (item: any) => void
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K views`
  return `${views} views`
}

const typeColors: Record<string, string> = {
  MOVIE: 'bg-red-500/10 text-red-400 border-red-500/20',
  TV_SHOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MUSIC: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  PODCAST: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  AUDIOBOOK: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  COLLECTION: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

const typeIcons: Record<string, string> = {
  MOVIE: '🎬',
  TV_SHOW: '📺',
  MUSIC: '🎵',
  PODCAST: '🎙️',
  AUDIOBOOK: '📖',
  COLLECTION: '📦',
}

const typeLabels: Record<string, string> = {
  MOVIE: 'Movie',
  TV_SHOW: 'TV',
  MUSIC: 'Music',
  PODCAST: 'Pod',
  AUDIOBOOK: 'Book',
  COLLECTION: 'Collection',
}

const itemtypeLabels: Record<string, string> = {
  Series: 'Series',
  Season: 'Season',
  Episode: 'Episode',
  MusicAlbum: 'Album',
  MusicArtist: 'Artist',
  AudioBook: 'Audiobook',
  Movie: 'Movie',
  Audio: 'Track',
  CollectionFolder: 'Library',
  UserView: 'Library',
  BoxSet: 'Collection',
}

export function MediaCard({ item, onWatchLater, onRemoveWatchLater, isInWatchLater: isInWatchLaterProp, onPlay }: MediaCardProps) {
  const { setCurrentMedia } = useAppStore()
  const isJellyfinFolder = item.isJellyfin && item.hasChildren
  const isCollection = item.type === 'COLLECTION' || item.itemType === 'BoxSet'

  const handleClick = () => {
    if (isJellyfinFolder || isCollection) {
      setCurrentMedia(item)
    } else if (onPlay) {
      onPlay(item)
    } else {
      setCurrentMedia(item)
    }
  }

  const handleWatchLaterClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInWatchLaterProp && onRemoveWatchLater) {
      onRemoveWatchLater(item.id)
    } else if (onWatchLater) {
      onWatchLater(item)
    }
  }

  const watchLaterActive = isInWatchLaterProp ?? false

  // Determine the badge label
  const badgeLabel = isJellyfinFolder
    ? (itemtypeLabels[item.itemType] || typeLabels[item.type] || item.type)
    : (typeLabels[item.type] || item.type)

  return (
    <Card
      className="group cursor-pointer border-0 shadow-none hover:shadow-lg transition-all duration-300 overflow-hidden bg-transparent media-card-hover"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative aspect-video rounded-lg overflow-hidden bg-muted",
        isCollection && "ring-1 ring-white/5"
      )}>
        {/* Collection stacked card effect */}
        {isCollection && (
          <>
            <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg bg-muted-foreground/10 -z-10" />
            <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg bg-muted-foreground/15 -z-5" />
          </>
        )}

        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted via-muted to-muted-foreground/20">
            {isCollection ? (
              <Layers className="h-10 w-10 text-muted-foreground/40" />
            ) : isJellyfinFolder ? (
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            ) : (
              <span className="text-4xl opacity-40">{typeIcons[item.type] || '🎬'}</span>
            )}
          </div>
        )}

        {/* Duration badge */}
        {item.duration && !isJellyfinFolder && !isCollection && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
            {item.duration}
          </div>
        )}

        {/* Child count badge for folders */}
        {isJellyfinFolder && item.childCount > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
            {item.childCount} items
          </div>
        )}

        {/* Community rating badge */}
        {item.communityRating && !isCollection && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-semibold backdrop-blur-sm flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Star className="h-2.5 w-2.5 fill-amber-400" />
            {item.communityRating.toFixed(1)}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
            {isJellyfinFolder || isCollection ? (
              <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                <ChevronRight className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                <Play className="h-5 w-5 text-white fill-white ml-0.5" />
              </div>
            )}
          </div>
        </div>

        {/* Watch Later overlay button */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full shadow-lg",
              watchLaterActive
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm"
            )}
            onClick={handleWatchLaterClick}
          >
            {watchLaterActive ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Type badge */}
        <div className="absolute top-1.5 left-1.5">
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1.5 py-0 h-4.5 backdrop-blur-md font-semibold", typeColors[item.type])}
          >
            {badgeLabel}
          </Badge>
        </div>

        {/* Jellyfin badge */}
        {item.isJellyfin && (
          <div className="absolute top-1.5 left-1.5 mt-5.5">
            <Badge
              variant="outline"
              className="text-[8px] px-1 py-0 h-4 backdrop-blur-md bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-0.5"
            >
              <Server className="h-2 w-2" />
              NAS
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-2.5 mt-2.5">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5 ring-1 ring-white/5">
          <AvatarFallback className={cn(
            "text-xs",
            item.isJellyfin ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
          )}>
            {item.isJellyfin ? <Server className="h-3.5 w-3.5" /> : (item.channel?.charAt(0) || item.artist?.charAt(0) || 'M')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-mythic transition-colors duration-200">
            {item.title}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {item.channel || item.artist || (item.isJellyfin ? 'Jellyfin NAS' : '')}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
            {item.communityRating && (
              <>
                <span className="flex items-center gap-0.5 text-amber-400">
                  <Star className="h-2.5 w-2.5 fill-amber-400" />
                  {item.communityRating.toFixed(1)}
                </span>
                <span className="text-muted-foreground/40">•</span>
              </>
            )}
            {!item.isJellyfin && (
              <>
                <Eye className="h-2.5 w-2.5" />
                <span>{formatViews(item.views)}</span>
                <span className="text-muted-foreground/40">•</span>
              </>
            )}
            {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover/95 backdrop-blur-md border-white/10">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                if (watchLaterActive && onRemoveWatchLater) {
                  onRemoveWatchLater(item.id)
                } else if (onWatchLater) {
                  onWatchLater(item)
                }
              }}
            >
              {watchLaterActive ? (
                <>
                  <Bookmark className="mr-2 h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-500">Saved to Watch Later</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Add to Watch Later
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
              <Clock className="mr-2 h-4 w-4" /> Watch Later
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
              Add to Playlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
