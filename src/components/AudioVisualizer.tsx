'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getSharedAudioContext, resumeAudioContext, isWebAudioSupported } from '@/lib/audioContext'

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | HTMLVideoElement | null
  isPlaying: boolean
  colorScheme?: 'purple' | 'emerald' | 'amber' | 'rose'
  className?: string
  height?: number
}

const colorSchemes = {
  purple: { from: '#8b5cf6', to: '#ec4899', mid: '#a855f7', bg: 'rgba(139, 92, 246, 0.1)' },
  emerald: { from: '#10b981', to: '#06b6d4', mid: '#14b8a6', bg: 'rgba(16, 185, 129, 0.1)' },
  amber: { from: '#f59e0b', to: '#ef4444', mid: '#f97316', bg: 'rgba(245, 158, 11, 0.1)' },
  rose: { from: '#f43f5e', to: '#a855f7', mid: '#d946ef', bg: 'rgba(244, 63, 94, 0.1)' },
}

export function AudioVisualizer({
  audioElement,
  isPlaying,
  colorScheme = 'purple',
  className,
  height = 200,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [visualizerType, setVisualizerType] = useState<'bars' | 'wave' | 'circle'>('bars')
  // Check WebAudio support synchronously on mount
  const [webAudioSupported] = useState(() => isWebAudioSupported())

  const color = colorSchemes[colorScheme]

  // Initialize Web Audio API — uses the shared audio context
  useEffect(() => {
    if (!audioElement || !webAudioSupported) return

    try {
      const { analyser } = getSharedAudioContext(audioElement)
      analyserRef.current = analyser
    } catch {
      // Silently fail - analyserRef will remain null
    }
  }, [audioElement, webAudioSupported])

  // Resume AudioContext when playing
  useEffect(() => {
    if (!audioElement) return
    if (isPlaying) {
      resumeAudioContext(audioElement)
    }
  }, [isPlaying, audioElement])

  // Draw loop
  const draw = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      animationRef.current = requestAnimationFrame(render)
      analyser.getByteFrequencyData(dataArray)

      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)

      // Subtle background glow
      ctx.fillStyle = color.bg
      ctx.fillRect(0, 0, width, height)

      if (visualizerType === 'bars') {
        const barCount = Math.min(bufferLength, 64)
        const barWidth = (width / barCount) * 0.8
        const gap = (width / barCount) * 0.2
        let x = 0

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i] / 255
          const barHeight = val * height * 0.85

          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
          gradient.addColorStop(0, color.from)
          gradient.addColorStop(0.5, color.mid)
          gradient.addColorStop(1, color.to)

          ctx.fillStyle = gradient
          // Rounded top bars
          const radius = Math.min(barWidth / 2, 3)
          const bx = x
          const by = height - barHeight
          const bw = barWidth
          const bh = barHeight

          ctx.beginPath()
          ctx.moveTo(bx + radius, by)
          ctx.lineTo(bx + bw - radius, by)
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius)
          ctx.lineTo(bx + bw, by + bh)
          ctx.lineTo(bx, by + bh)
          ctx.lineTo(bx, by + radius)
          ctx.quadraticCurveTo(bx, by, bx + radius, by)
          ctx.closePath()
          ctx.fill()

          x += barWidth + gap
        }
      } else if (visualizerType === 'wave') {
        // Waveform visualization
        analyser.getByteTimeDomainData(dataArray)
        ctx.lineWidth = 2.5
        ctx.strokeStyle = color.from
        ctx.shadowColor = color.mid
        ctx.shadowBlur = 8
        ctx.beginPath()

        const sliceWidth = width / bufferLength
        let x = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * height) / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        ctx.shadowBlur = 0

        // Second pass with slight offset for glow
        ctx.lineWidth = 1
        ctx.strokeStyle = color.to
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        x = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * height) / 2 + 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      } else if (visualizerType === 'circle') {
        const centerX = width / 2
        const centerY = height / 2
        const radius = Math.min(width, height) * 0.22

        // Inner glow circle
        const glowGradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius)
        glowGradient.addColorStop(0, 'transparent')
        glowGradient.addColorStop(1, color.bg)
        ctx.fillStyle = glowGradient
        ctx.fillRect(0, 0, width, height)

        const barCount = Math.min(bufferLength, 80)
        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i] / 255
          const barHeight = val * radius * 0.8
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2

          const x1 = centerX + Math.cos(angle) * radius
          const y1 = centerY + Math.sin(angle) * radius
          const x2 = centerX + Math.cos(angle) * (radius + barHeight)
          const y2 = centerY + Math.sin(angle) * (radius + barHeight)

          ctx.lineWidth = 2.5
          const alpha = 0.3 + val * 0.7
          const fromR = parseInt(color.from.slice(1, 3), 16)
          const fromG = parseInt(color.from.slice(3, 5), 16)
          const fromB = parseInt(color.from.slice(5, 7), 16)
          ctx.strokeStyle = `rgba(${fromR}, ${fromG}, ${fromB}, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }

        // Center circle
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2)
        ctx.fillStyle = color.bg
        ctx.fill()
        ctx.strokeStyle = `${color.from}33`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [visualizerType, colorScheme, color, height])

  useEffect(() => {
    const cleanup = draw()
    return () => {
      cleanup?.()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw])

  if (!webAudioSupported) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-muted/30',
          className
        )}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <svg className="h-5 w-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Audio visualization not available</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative rounded-xl overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height}
        className="w-full h-full"
      />
      {/* Visualizer type selector */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        {(['bars', 'wave', 'circle'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setVisualizerType(type)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full transition-colors capitalize',
              visualizerType === type
                ? 'bg-white/20 text-white backdrop-blur-sm'
                : 'bg-black/20 text-white/50 hover:text-white/80'
            )}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  )
}
