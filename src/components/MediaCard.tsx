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
  MOVIE: 'bg-red-500/10 text-red-500 border-red-500/20',
  TV_SHOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  MUSIC: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  PODCAST: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  AUDIOBOOK: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
}

const typeIcons: Record<string, string> = {
  MOVIE: '🎬',
  TV_SHOW: '📺',
  MUSIC: '🎵',
  PODCAST: '🎙️',
  AUDIOBOOK: '📖',
}

export function MediaCard({ item, onWatchLater, onRemoveWatchLater, isInWatchLater: isInWatchLaterProp, onPlay }: MediaCardProps) {
  const { setCurrentMedia } = useAppStore()

  const handleClick = () => {
    if (onPlay) {
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

  return (
    <Card
      className="group cursor-pointer border-0 shadow-none hover:shadow-md transition-all duration-200 overflow-hidden bg-transparent"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-4xl">{typeIcons[item.type] || '🎬'}</span>
          </div>
        )}

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {item.duration}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
              <Play className="h-6 w-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Watch Later overlay button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full shadow-md",
              watchLaterActive
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-black/70 text-white hover:bg-black/90"
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
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 h-5 backdrop-blur-sm", typeColors[item.type])}
          >
            {item.type === 'TV_SHOW' ? 'TV' : item.type === 'PODCAST' ? 'Pod' : item.type === 'AUDIOBOOK' ? 'Book' : item.type}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-3 mt-3">
        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs bg-muted">
            {item.channel?.charAt(0) || item.artist?.charAt(0) || 'M'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {item.channel || item.artist}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Eye className="h-3 w-3" />
            <span>{formatViews(item.views)}</span>
            <span>•</span>
            <span>{item.releaseYear}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
