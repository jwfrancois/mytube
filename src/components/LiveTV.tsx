'use client'

import { useAppStore } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Radio, RefreshCw, Tv, AlertCircle } from 'lucide-react'
import { useEffect, useCallback } from 'react'

export function LiveTV() {
  const {
    liveTVChannels,
    setLiveTVChannels,
    liveTVLoading,
    setLiveTVLoading,
    setCurrentMedia,
  } = useAppStore()

  const fetchChannels = useCallback(async () => {
    setLiveTVLoading(true)
    try {
      const res = await fetch('/api/livetv')
      const data = await res.json()
      setLiveTVChannels(data.channels || [])
    } catch (err) {
      console.error('Failed to fetch Live TV channels:', err)
    } finally {
      setLiveTVLoading(false)
    }
  }, [setLiveTVChannels, setLiveTVLoading])

  useEffect(() => {
    if (liveTVChannels.length === 0) {
      fetchChannels()
    }
  }, [fetchChannels, liveTVChannels.length])

  const handlePlayChannel = (channel: any) => {
    setCurrentMedia({
      id: channel.id,
      title: channel.name,
      description: `Live TV - ${channel.genre} Channel`,
      type: 'LIVETV',
      genre: channel.genre,
      thumbnail: channel.thumbnail || '',
      videoUrl: channel.url,
      duration: 'LIVE',
      releaseYear: 2026,
      artist: '',
      views: 0,
      channel: channel.name,
      createdAt: new Date().toISOString(),
      status: 'Live',
      // For Jellyfin LiveTV channels, mark as Jellyfin with the ID
      ...(channel.id.startsWith('jf-livetv-') && {
        isJellyfin: true,
        jellyfinId: channel.id.replace('jf-livetv-', ''),
      }),
    })
  }

  if (liveTVLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const genreGroups: Record<string, any[]> = {}
  liveTVChannels.forEach((ch) => {
    const g = ch.genre || 'General'
    if (!genreGroups[g]) genreGroups[g] = []
    genreGroups[g].push(ch)
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Live TV</h1>
          <Badge variant="outline" className="text-xs gap-1 text-red-500 border-red-500/30">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {liveTVChannels.length} channels
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchChannels} className="gap-1">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {liveTVChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No Live TV channels available</p>
          <p className="text-sm mt-1">Check that your HDHomerun tuner is connected to the network</p>
          <Button variant="outline" size="sm" onClick={fetchChannels} className="mt-4 gap-1">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : (
        Object.entries(genreGroups).map(([genre, channels]) => (
          <section key={genre} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Tv className="h-4 w-4 text-muted-foreground" />
              {genre}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="group cursor-pointer border-0 shadow-none hover:shadow-md transition-all duration-200 overflow-hidden bg-transparent"
                  onClick={() => handlePlayChannel(channel)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                    {channel.thumbnail ? (
                      <img
                        src={channel.thumbnail}
                        alt={channel.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/20 to-orange-500/20">
                        <div className="flex flex-col items-center gap-2">
                          <Tv className="h-10 w-10 text-red-400/60" />
                          <span className="text-3xl font-bold text-red-400/40">
                            {channel.hdhrChannelNumber || ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* LIVE badge */}
                    <div className="absolute top-2 left-2">
                      <Badge className="text-[10px] px-1.5 py-0 h-5 bg-red-500 text-white border-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse mr-1" />
                        LIVE
                      </Badge>
                    </div>

                    {/* Channel number */}
                    {channel.hdhrChannelNumber && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        Ch {channel.hdhrChannelNumber}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center">
                          <Radio className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex gap-3 mt-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {channel.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {channel.genre} • Channel {channel.hdhrChannelNumber}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
