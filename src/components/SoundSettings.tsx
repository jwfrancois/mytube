'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Volume2,
  Volume1,
  VolumeX,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSharedAudioContext, resumeAudioContext } from '@/lib/audioContext'

// EQ presets: each defines gain values for frequency bands
const EQ_PRESETS: Record<string, { label: string; icon: string; bands: number[] }> = {
  flat: { label: 'Flat', icon: '➖', bands: [0, 0, 0, 0, 0] },
  'bass-boost': { label: 'Bass Boost', icon: '🔊', bands: [6, 4, 0, 0, -1] },
  'treble-boost': { label: 'Treble Boost', icon: '🔉', bands: [-1, 0, 0, 4, 6] },
  vocal: { label: 'Vocal', icon: '🎤', bands: [-2, 0, 4, 3, 0] },
  'night-mode': { label: 'Night Mode', icon: '🌙', bands: [-3, -1, 2, -1, -3] },
}

const EQ_LABELS = ['60', '230', '910', '4k', '14k']

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface SoundSettingsProps {
  audioElement: HTMLAudioElement | HTMLVideoElement | null
  compact?: boolean
  /** When true, volume/speed sync is skipped (used for video player which manages its own sync) */
  disableVolumeSpeedSync?: boolean
}

export function SoundSettings({ audioElement, compact = false, disableVolumeSpeedSync = false }: SoundSettingsProps) {
  const {
    volume,
    setVolume,
    playbackSpeed,
    setPlaybackSpeed,
    equalizerPreset,
    setEqualizerPreset,
  } = useAppStore()

  // Keep a ref to the current audio element so the EQ effect can reference it
  const elRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)

  // Keep the local ref in sync with the prop
  useEffect(() => {
    elRef.current = audioElement
  }, [audioElement])

  // Apply EQ bands using the shared audio context
  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const bands = EQ_PRESETS[equalizerPreset]?.bands || EQ_PRESETS.flat.bands

    try {
      const { setEqBands } = getSharedAudioContext(el)
      setEqBands(bands)

      // Resume context if suspended (e.g., after user interaction)
      resumeAudioContext(el)
    } catch {
      // Shared context creation failed — EQ won't work but audio still plays
    }
  }, [equalizerPreset])

  // Apply volume to the audio element (skip when parent manages sync)
  useEffect(() => {
    if (disableVolumeSpeedSync) return
    const el = elRef.current
    if (el) {
      el.volume = volume
    }
  }, [volume, disableVolumeSpeedSync])

  // Apply playback speed to the audio element (skip when parent manages sync)
  useEffect(() => {
    if (disableVolumeSpeedSync) return
    const el = elRef.current
    if (el) {
      el.playbackRate = playbackSpeed
    }
  }, [playbackSpeed, disableVolumeSpeedSync])

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  if (compact) {
    return (
      <div className="space-y-3 p-3">
        {/* Volume */}
        <div className="flex items-center gap-2">
          <VolumeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v / 100)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Playback speed */}
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1 flex-1">
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded transition-colors',
                  playbackSpeed === speed
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* EQ presets */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1 flex-1 flex-wrap">
            {Object.entries(EQ_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setEqualizerPreset(key)}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5',
                  equalizerPreset === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground'
                )}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 min-w-[280px]">
      {/* Volume Control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <VolumeIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Volume</span>
          </div>
          <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
        </div>
        <Slider
          value={[volume * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => setVolume(v / 100)}
        />
        <div className="flex justify-between mt-1">
          <button
            onClick={() => setVolume(0)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Mute
          </button>
          <button
            onClick={() => setVolume(1)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Max
          </button>
        </div>
      </div>

      {/* Playback Speed */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Playback Speed</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {PLAYBACK_SPEEDS.map((speed) => (
            <Button
              key={speed}
              variant={playbackSpeed === speed ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPlaybackSpeed(speed)}
            >
              {speed}x
            </Button>
          ))}
        </div>
      </div>

      {/* Equalizer Presets */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Equalizer</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(EQ_PRESETS).map(([key, preset]) => (
            <Button
              key={key}
              variant={equalizerPreset === key ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs justify-start gap-1.5"
              onClick={() => setEqualizerPreset(key)}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
              {equalizerPreset === key && (
                <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px]">
                  Active
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Visual EQ Bands */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">Frequency Bands</div>
        <div className="flex items-end gap-2 h-24">
          {EQ_PRESETS[equalizerPreset]?.bands.map((gain, i) => {
            const heightPercent = 50 + (gain / 6) * 50 // Map -6..6 to 0..100
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground">
                  {gain > 0 ? '+' : ''}{gain}
                </span>
                <div className="w-full bg-muted rounded-full overflow-hidden" style={{ height: '60px' }}>
                  <div
                    className={cn(
                      'w-full rounded-full transition-all duration-300',
                      gain > 0 ? 'bg-primary' : gain < 0 ? 'bg-destructive' : 'bg-muted-foreground/30'
                    )}
                    style={{
                      height: `${Math.max(heightPercent, 5)}%`,
                      marginTop: gain < 0 ? '0' : `${100 - heightPercent}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{EQ_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
