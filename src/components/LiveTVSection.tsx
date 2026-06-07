'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Radio,
  Play,
  ChevronRight,
  Heart,
  Tv,
  Film,
  Music,
  Newspaper,
  Trophy,
  Baby,
  Globe,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LiveTVChannel,
  LIVE_TV_CATEGORIES,
  EXTERNAL_SERVICES,
} from '@/lib/livetv-channels'
import { getHDHomerunIp, fetchHDHomerunLineup, ParsedHDHomerunChannel, setHDHomerunIp } from '@/lib/hdhomerun-client'

const categoryIconMap: Record<string, React.ElementType> = {
  Newspaper: Newspaper,
  Tv: Tv,
  Film: Film,
  Trophy: Trophy,
  Music: Music,
  Baby: Baby,
  Globe: Globe,
}

interface LiveTVSectionProps {
  onPlay: (item: MediaItem) => void
  onViewAll: () => void
}

export function LiveTVSection({ onPlay, onViewAll }: LiveTVSectionProps) {
  const [channels, setChannels] = useState<LiveTVChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])
  const { setHdhrConnected, setHdhrTunerIp } = useAppStore()

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await fetch('/api/livetv/channels')
        if (res.ok) {
          const data = await res.json()
          let allChannels: LiveTVChannel[] = data.channels || []

          // Try server-side HDHomerun channels first (avoids CORS issues)
          let hdhrChannelsFound = false
          try {
            const hdhrRes = await fetch('/api/hdhomerun/channels')
            if (hdhrRes.ok) {
              const hdhrData = await hdhrRes.json()
              if (hdhrData.channels && hdhrData.channels.length > 0) {
                hdhrChannelsFound = true
                setHdhrConnected(true)
                if (hdhrData.tuner?.tunerIp) setHdhrTunerIp(hdhrData.tuner.tunerIp)
                allChannels = [...allChannels, ...hdhrData.channels]
              }
            }
          } catch {
            // Server-side HDHomerun fetch failed
          }

          // Fallback: try client-side fetch (for when server is in the cloud
          // and can't reach local network devices)
          if (!hdhrChannelsFound) {
            const hdhrIp = data.hdhrTunerIp || getHDHomerunIp()
            if (hdhrIp) {
              try {
                const hdhrChannels = await fetchHDHomerunLineup(hdhrIp)
                if (hdhrChannels.length > 0) {
                  setHdhrTunerIp(hdhrIp)
                  setHdhrConnected(true)
                  const liveTVChannels: LiveTVChannel[] = hdhrChannels.map(ch => ({
                    id: ch.id,
                    name: ch.name,
                    category: ch.category,
                    streamUrl: ch.streamUrl,
                    logoUrl: ch.logoUrl,
                    description: ch.description,
                    source: ch.source,
                    language: ch.language,
                    country: ch.country,
                    guideNumber: ch.guideNumber,
                    hd: ch.hd,
                    tunerIp: ch.tunerIp,
                  }))
                  allChannels = [...allChannels, ...liveTVChannels]
                }
              } catch {
                // HDHomerun not reachable from browser either
              }
            }
          }

          setChannels(allChannels)
        }
      } catch (err) {
        console.error('Failed to fetch Live TV channels:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChannels()
  }, [setHdhrConnected, setHdhrTunerIp])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('livetv-favorites')
      if (saved) setFavorites(JSON.parse(saved))
    } catch {}
  }, [])

  const handlePlayChannel = useCallback((channel: LiveTVChannel) => {
    const mediaItem: MediaItem = {
      id: channel.id,
      title: channel.name,
      description: channel.description,
      type: 'LIVETV',
      genre: channel.category,
      thumbnail: channel.logoUrl || '',
      videoUrl: channel.streamUrl,
      duration: 'LIVE',
      releaseYear: new Date().getFullYear(),
      artist: channel.source === 'hdhomerun' ? 'HDHomerun OTA' : channel.source,
      views: 0,
      channel: channel.source === 'hdhomerun' ? `OTA Ch. ${channel.guideNumber || ''}` : channel.source,
      createdAt: new Date().toISOString(),
      isJellyfin: channel.source === 'jellyfin',
      jellyfinId: channel.source === 'jellyfin' ? channel.id.replace('jellyfin-livetv-', '') : undefined,
    }
    onPlay(mediaItem)
  }, [onPlay])

  const toggleFavorite = useCallback((channelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
      try { localStorage.setItem('livetv-favorites', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Show featured channels (news + a mix of categories, prioritize HDHomerun OTA channels)
  const featuredChannels = channels.length > 0
    ? [
        // Show up to 4 HDHomerun channels first (they're the user's actual OTA channels)
        ...channels.filter(ch => ch.source === 'hdhomerun').slice(0, 4),
        // Then fill with other sources
        ...channels.filter(ch => ch.category === 'news' && ch.source !== 'hdhomerun').slice(0, 2),
        ...channels.filter(ch => ch.category === 'entertainment' && ch.source !== 'hdhomerun').slice(0, 2),
        ...channels.filter(ch => ch.category === 'movies' && ch.source !== 'hdhomerun').slice(0, 2),
        ...channels.filter(ch => ch.category === 'sports' && ch.source !== 'hdhomerun').slice(0, 1),
      ].slice(0, 12)
    : []

  if (!loading && channels.length === 0) return null

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Radio className="h-5 w-5 text-red-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold">Live TV</h2>
          <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
            LIVE
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onViewAll}>
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[200px]">
              <div className="aspect-video rounded-lg bg-muted/20 animate-pulse mb-2" />
              <div className="h-3 w-3/4 bg-muted/20 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Channel Cards - Horizontal Scroll */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {featuredChannels.map(channel => {
              const catInfo = LIVE_TV_CATEGORIES.find(c => c.id === channel.category)
              const IconComp = catInfo ? (categoryIconMap[catInfo.icon] || Tv) : Tv
              const isFav = favorites.includes(channel.id)

              return (
                <div
                  key={channel.id}
                  className="shrink-0 w-[200px] group cursor-pointer"
                  onClick={() => handlePlayChannel(channel)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted/20 mb-2 border border-border/20 group-hover:border-primary/30 transition-all">
                    {channel.logoUrl ? (
                      <img src={channel.logoUrl} alt={channel.name} className="w-full h-full object-contain p-3" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <IconComp className={cn('h-7 w-7 opacity-40', catInfo?.color || 'text-muted-foreground')} />
                      </div>
                    )}

                    {/* Live Badge */}
                    <Badge className="absolute top-1.5 left-1.5 text-[7px] h-3.5 bg-red-500 text-white gap-0.5 shadow">
                      <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                      LIVE
                    </Badge>

                    {/* Favorite */}
                    <button
                      className={cn(
                        'absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center transition-all',
                        isFav ? 'bg-red-500 text-white' : 'bg-black/40 text-white/60 opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => toggleFavorite(channel.id, e)}
                    >
                      <Heart className="h-2.5 w-2.5" fill={isFav ? 'currentColor' : 'none'} />
                    </button>

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                        <Play className="h-4 w-4 text-black fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-1">
                    {channel.guideNumber && (
                      <span className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1 rounded">
                        {channel.guideNumber}
                      </span>
                    )}
                    <h3 className="text-xs font-medium truncate">{channel.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[10px] text-muted-foreground capitalize">{channel.category}</p>
                    {channel.source === 'hdhomerun' && (
                      <Badge variant="outline" className="text-[7px] h-3 text-amber-400 border-amber-500/30 px-0.5">
                        OTA
                      </Badge>
                    )}
                    {channel.hd && (
                      <Badge variant="outline" className="text-[7px] h-3 text-cyan-400 border-cyan-500/30 px-0.5">
                        HD
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Access - External Services */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {EXTERNAL_SERVICES.map(service => (
              <button
                key={service.id}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                onClick={() => window.open(service.url, '_blank')}
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <span>{service.name}</span>
                <Badge variant="outline" className="text-[7px] h-3.5 text-emerald-400 border-emerald-500/30 px-1">
                  FREE
                </Badge>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
