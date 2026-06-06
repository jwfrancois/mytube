'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tv,
  Search,
  Heart,
  ExternalLink,
  Radio,
  Play,
  Globe,
  Film,
  Music,
  Newspaper,
  Trophy,
  Baby,
  Heart as HeartIcon,
  Microscope,
  Gamepad2,
  Search as SearchIcon,
  Laugh,
  ArrowLeft,
  Loader2,
  Star,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LiveTVChannel,
  LiveTVCategory,
  LIVE_TV_CATEGORIES,
  EXTERNAL_SERVICES,
  LiveTVCategoryInfo,
} from '@/lib/livetv-channels'

// Map category icons
const categoryIconMap: Record<string, React.ElementType> = {
  Newspaper: Newspaper,
  Tv: Tv,
  Film: Film,
  Trophy: Trophy,
  Music: Music,
  Baby: Baby,
  Heart: HeartIcon,
  Microscope: Microscope,
  Laugh: Laugh,
  Search: SearchIcon,
  Gamepad2: Gamepad2,
  Globe: Globe,
}

interface LiveTVGuideProps {
  onPlay: (item: MediaItem) => void
  onBack?: () => void
}

export function LiveTVGuide({ onPlay, onBack }: LiveTVGuideProps) {
  const [channels, setChannels] = useState<LiveTVChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<LiveTVCategory | 'all' | 'favorites'>('all')
  const [favorites, setFavorites] = useState<string[]>([])
  const [selectedChannel, setSelectedChannel] = useState<LiveTVChannel | null>(null)
  const [epgData, setEpgData] = useState<any[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('livetv-favorites')
      if (saved) setFavorites(JSON.parse(saved))
    } catch {}
  }, [])

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('livetv-favorites', JSON.stringify(favorites))
    } catch {}
  }, [favorites])

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/livetv/channels?includeJellyfin=true')
        if (res.ok) {
          const data = await res.json()
          setChannels(data.channels || [])
        }
      } catch (err) {
        console.error('Failed to fetch Live TV channels:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChannels()
  }, [])

  // Fetch EPG for selected channel
  useEffect(() => {
    if (!selectedChannel) return
    const fetchEPG = async () => {
      try {
        const res = await fetch(`/api/livetv/epg?channelId=${selectedChannel.id}`)
        if (res.ok) {
          const data = await res.json()
          setEpgData(data.programs || [])
        }
      } catch {
        setEpgData([])
      }
    }
    fetchEPG()
  }, [selectedChannel])

  const toggleFavorite = useCallback((channelId: string) => {
    setFavorites(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    )
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
      artist: channel.source,
      views: 0,
      channel: channel.source,
      createdAt: new Date().toISOString(),
      isJellyfin: channel.source === 'jellyfin',
      jellyfinId: channel.source === 'jellyfin' ? channel.id.replace('jellyfin-livetv-', '') : undefined,
    }
    onPlay(mediaItem)
  }, [onPlay])

  // Filter channels
  const filteredChannels = channels.filter(ch => {
    if (activeCategory === 'favorites') return favorites.includes(ch.id)
    if (activeCategory === 'all') return true
    return ch.category === activeCategory
  }).filter(ch => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return ch.name.toLowerCase().includes(q) || ch.description.toLowerCase().includes(q)
  })

  // Group filtered channels by category
  const groupedByCategory: Record<string, LiveTVChannel[]> = {}
  for (const ch of filteredChannels) {
    if (!groupedByCategory[ch.category]) groupedByCategory[ch.category] = []
    groupedByCategory[ch.category].push(ch)
  }

  const getCategoryInfo = (catId: string): LiveTVCategoryInfo | undefined =>
    LIVE_TV_CATEGORIES.find(c => c.id === catId)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className="h-5 w-5 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <h1 className="text-lg font-bold">Live TV</h1>
            <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
              LIVE
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {channels.length} channels
          </span>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search channels..."
              className="pl-8 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
          <TabsList className="bg-muted/50 h-8 p-0.5">
            <TabsTrigger value="all" className="text-xs h-7 px-2.5">
              All
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs h-7 px-2.5">
              <Heart className="h-3 w-3 mr-1" />
              Favorites
            </TabsTrigger>
            {LIVE_TV_CATEGORIES.slice(0, 8).map(cat => {
              const IconComp = categoryIconMap[cat.icon] || Tv
              return (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs h-7 px-2.5 hidden sm:inline-flex">
                  <IconComp className="h-3 w-3 mr-1" />
                  {cat.name}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Radio className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">
                {activeCategory === 'favorites'
                  ? 'No favorite channels yet. Heart a channel to add it here.'
                  : 'No channels found'}
              </p>
            </div>
          ) : activeCategory === 'all' && !searchQuery ? (
            // Grouped by category
            <div className="p-4 space-y-6">
              {Object.entries(groupedByCategory).map(([catId, catChannels]) => {
                const catInfo = getCategoryInfo(catId)
                const IconComp = catInfo ? (categoryIconMap[catInfo.icon] || Tv) : Tv
                return (
                  <div key={catId}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconComp className={cn('h-4 w-4', catInfo?.color || 'text-muted-foreground')} />
                      <h3 className="text-sm font-semibold">{catInfo?.name || catId}</h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {catChannels.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {catChannels.map(channel => (
                        <ChannelCard
                          key={channel.id}
                          channel={channel}
                          isFavorite={favorites.includes(channel.id)}
                          onToggleFavorite={toggleFavorite}
                          onPlay={handlePlayChannel}
                          isSelected={selectedChannel?.id === channel.id}
                          onSelect={setSelectedChannel}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Flat grid for filtered/favorites
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredChannels.map(channel => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    isFavorite={favorites.includes(channel.id)}
                    onToggleFavorite={toggleFavorite}
                    onPlay={handlePlayChannel}
                    isSelected={selectedChannel?.id === channel.id}
                    onSelect={setSelectedChannel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* External Services Section */}
          {activeCategory === 'all' && !searchQuery && (
            <div className="p-4 border-t border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-teal-400" />
                <h3 className="text-sm font-semibold">More Free Streaming Services</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {EXTERNAL_SERVICES.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {EXTERNAL_SERVICES.map(service => (
                  <div
                    key={service.id}
                    className="relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br backdrop-blur-sm group cursor-pointer"
                    onClick={() => window.open(service.url, '_blank')}
                  >
                    <div className={cn('absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity', service.color)} />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">{service.name}</h4>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {service.channelCount} channels
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                          FREE
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel - EPG for selected channel */}
        {selectedChannel && (
          <div className="w-72 border-l border-border/30 bg-muted/20 shrink-0 hidden lg:block">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                    <Radio className="h-5 w-5 text-red-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{selectedChannel.name}</h3>
                  <p className="text-[10px] text-muted-foreground capitalize">{selectedChannel.category}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedChannel(null)}
                >
                  ×
                </Button>
              </div>

              <Button
                className="w-full gap-2 mb-4"
                onClick={() => handlePlayChannel(selectedChannel)}
              >
                <Play className="h-4 w-4 fill-current" />
                Watch Now
              </Button>

              <p className="text-xs text-muted-foreground mb-4">{selectedChannel.description}</p>

              <Separator className="mb-4" />

              {/* EPG Schedule */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</h4>
                {epgData.length > 0 ? (
                  epgData.map((prog: any) => (
                    <div
                      key={prog.id}
                      className={cn(
                        'p-2 rounded-lg text-xs',
                        prog.isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-muted-foreground tabular-nums">
                          {new Date(prog.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {prog.isCurrent && (
                          <Badge className="text-[8px] h-4 bg-red-500 text-white">LIVE</Badge>
                        )}
                      </div>
                      <p className={cn('font-medium', prog.isCurrent && 'text-primary')}>
                        {prog.title}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Schedule not available for this channel.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Channel Card ──────────────────────────────────────────────

function ChannelCard({
  channel,
  isFavorite,
  onToggleFavorite,
  onPlay,
  isSelected,
  onSelect,
}: {
  channel: LiveTVChannel
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onPlay: (channel: LiveTVChannel) => void
  isSelected: boolean
  onSelect: (channel: LiveTVChannel) => void
}) {
  const catInfo = LIVE_TV_CATEGORIES.find(c => c.id === channel.category)
  const IconComp = catInfo ? (categoryIconMap[catInfo.icon] || Tv) : Tv

  return (
    <div
      className={cn(
        'relative group rounded-xl border overflow-hidden cursor-pointer transition-all duration-200',
        'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/30 bg-card/50',
      )}
      onClick={() => onSelect(channel)}
    >
      {/* Channel Visual */}
      <div className="relative aspect-video bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center overflow-hidden">
        {channel.logoUrl ? (
          <img src={channel.logoUrl} alt={channel.name} className="w-full h-full object-contain p-4" />
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <IconComp className={cn('h-8 w-8 opacity-50', catInfo?.color || 'text-muted-foreground')} />
            <span className="text-[10px] text-muted-foreground font-medium max-w-[90%] text-center truncate">
              {channel.name}
            </span>
          </div>
        )}

        {/* Live Badge */}
        <div className="absolute top-2 left-2">
          <Badge className="text-[8px] h-4 bg-red-500 text-white gap-0.5 shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
        </div>

        {/* Favorite Button */}
        <button
          className={cn(
            'absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-all',
            isFavorite
              ? 'bg-red-500 text-white'
              : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id) }}
        >
          <Heart className="h-3 w-3" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <Button
            className="h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onPlay(channel) }}
          >
            <Play className="h-5 w-5 fill-current" />
          </Button>
        </div>
      </div>

      {/* Channel Info */}
      <div className="p-2.5">
        <h4 className="text-xs font-semibold truncate">{channel.name}</h4>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-[8px] h-4 capitalize">
            {channel.category}
          </Badge>
          {channel.source === 'jellyfin' && (
            <Badge variant="outline" className="text-[8px] h-4 text-emerald-400 border-emerald-500/30">
              NAS
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
