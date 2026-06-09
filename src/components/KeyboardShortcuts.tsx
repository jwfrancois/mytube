'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShortcutItem {
  keys: string[]
  description: string
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Space', 'K'], description: 'Play / Pause' },
  { keys: ['←', '→'], description: 'Seek ±10s' },
  { keys: ['↑', '↓'], description: 'Volume ±10%' },
  { keys: ['M'], description: 'Mute / Unmute' },
  { keys: ['F'], description: 'Fullscreen' },
  { keys: ['N'], description: 'Next track (audio)' },
  { keys: ['P'], description: 'Previous track (audio)' },
  { keys: ['?'], description: 'Show shortcuts' },
  { keys: ['Esc'], description: 'Close' },
]

export function KeyboardShortcuts() {
  const [visible, setVisible] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Show on '?'
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      setVisible(prev => !prev)
    }
    // Hide on Escape
    if (e.key === 'Escape') {
      setVisible(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close on click outside
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setVisible(false)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <Card className="w-full max-w-md mx-4 shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-5 w-5 text-purple-500" />
            Keyboard Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-1.5">
            {SHORTCUTS.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm text-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <span key={keyIndex}>
                      {keyIndex > 0 && (
                        <span className="text-xs text-muted-foreground mx-1">/</span>
                      )}
                      <kbd className={cn(
                        "inline-flex items-center justify-center min-w-[28px] h-7 px-2",
                        "rounded-md border border-border bg-muted/80",
                        "text-xs font-medium text-muted-foreground",
                        "shadow-sm"
                      )}>
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Press <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded border border-border bg-muted/80 text-[10px] font-medium shadow-sm">Esc</kbd> to close
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
