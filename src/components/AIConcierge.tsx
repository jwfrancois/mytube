'use client'

import { useState, useCallback, useRef } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Send, RotateCcw, AlertCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIConciergeProps {
  onPlay: (item: MediaItem) => void
}

const SUGGESTION_CHIPS = [
  'Find jazz music for a rainy evening',
  'Show me sci-fi movies from the 2010s',
  'Play something relaxing for studying',
  'Find documentaries about AI',
  'Play an action movie with great visuals',
]

export function AIConcierge({ onPlay }: AIConciergeProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<MediaItem[]>([])
  const [interpretation, setInterpretation] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return

    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    if (!searchQuery) setQuery(q)

    try {
      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to search')
      }

      const data = await res.json()
      setResults(data.items || [])
      setInterpretation(data.interpretation || '')
      setSuggestions(data.suggestions || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setResults([])
      setInterpretation('')
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [query])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }, [handleSearch])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion)
    handleSearch(suggestion)
  }, [handleSearch])

  const handleRetry = useCallback(() => {
    setError(null)
    handleSearch()
  }, [handleSearch])

  return (
    <div ref={panelRef} id="ai-concierge" className="px-6 mb-8 scroll-mt-4">
      {/* Glassmorphism Panel */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-purple-500/10 via-pink-500/8 to-purple-600/5",
        "border border-purple-500/20",
        "backdrop-blur-xl shadow-2xl shadow-purple-500/5"
      )}>
        {/* Subtle animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-pink-500/5 to-purple-600/5 animate-pulse opacity-50" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative z-10 p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                AI Media Concierge
              </h2>
              <p className="text-xs text-muted-foreground/70">Find anything in your library with natural language</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI to find anything... e.g., 'Play a movie like Interstellar but more emotional'"
                disabled={isLoading}
                className={cn(
                  "h-12 pl-4 pr-4 text-base",
                  "bg-white/5 border-purple-500/20 focus:border-purple-400/50",
                  "placeholder:text-muted-foreground/40",
                  "rounded-xl backdrop-blur-sm",
                  "transition-all duration-300",
                  "hover:bg-white/8 focus:bg-white/10"
                )}
              />
            </div>
            <Button
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className={cn(
                "h-12 px-6 rounded-xl font-semibold gap-2",
                "bg-gradient-to-r from-purple-500 to-pink-500",
                "hover:from-purple-600 hover:to-pink-600",
                "shadow-lg shadow-purple-500/25",
                "transition-all duration-300",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </Button>
          </div>

          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-2 mb-2">
            {SUGGESTION_CHIPS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full",
                  "bg-white/5 border border-purple-500/15",
                  "text-muted-foreground/80 hover:text-purple-300",
                  "hover:bg-purple-500/10 hover:border-purple-500/30",
                  "transition-all duration-200 cursor-pointer",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Results Area */}
          {hasSearched && (
            <div className="mt-6">
              {/* Interpretation Badge */}
              {interpretation && !isLoading && !error && (
                <div className="flex items-center gap-2 mb-4">
                  <Badge
                    variant="outline"
                    className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs gap-1.5 py-1"
                  >
                    <Lightbulb className="h-3 w-3" />
                    {interpretation}
                  </Badge>
                </div>
              )}

              {/* Suggestion Chips from AI */}
              {suggestions.length > 0 && !isLoading && !error && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs text-muted-foreground/50 self-center mr-1">Try:</span>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      disabled={isLoading}
                      className="px-2.5 py-1 text-[11px] rounded-full bg-white/5 border border-white/10 text-muted-foreground/60 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/20 transition-all duration-200 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="shrink-0 w-[200px] sm:w-[220px] space-y-2">
                      <Skeleton className="aspect-video rounded-lg w-full shimmer" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-1 flex-1">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Results */}
              {!isLoading && !error && results.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 shelf-scrollbar">
                  {results.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="shrink-0 w-[200px] sm:w-[220px] lg:w-[240px]">
                      <MediaCard item={item} onPlay={onPlay} />
                    </div>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!isLoading && !error && hasSearched && results.length === 0 && (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground/60">No matches found. Try a different query.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
