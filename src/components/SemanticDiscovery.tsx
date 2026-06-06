'use client'

import { useState, useCallback } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Brain,
  Heart,
  Palette,
  Sparkles,
  Send,
  RotateCcw,
  AlertCircle,
  Lightbulb,
  Swords,
  Sunrise,
  Ghost,
  PartyPopper,
  Rewind,
  Flame,
  Feather,
  HeartHandshake,
  Baby,
  ArrowUpFromLine,
  Trophy,
  TreePine,
  Cpu,
  Users,
  Skull,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SemanticDiscoveryProps {
  onPlay: (item: MediaItem) => void
}

// --- Mood Card Definitions ---

interface MoodCard {
  id: string
  name: string
  mood: string
  icon: React.ElementType
  gradient: string
  iconColor: string
}

const MOOD_CARDS: MoodCard[] = [
  { id: 'epic-grand', name: 'Epic & Grand', mood: 'epic grand cinematic sweeping', icon: Swords, gradient: 'from-amber-600 to-red-700', iconColor: 'text-amber-200' },
  { id: 'heartwarming', name: 'Heartwarming', mood: 'heartwarming wholesome touching feel-good', icon: Sunrise, gradient: 'from-rose-500 to-pink-600', iconColor: 'text-rose-100' },
  { id: 'dark-mysterious', name: 'Dark & Mysterious', mood: 'dark mysterious suspenseful eerie', icon: Ghost, gradient: 'from-gray-800 to-gray-950', iconColor: 'text-gray-300' },
  { id: 'joyful-upbeat', name: 'Joyful & Upbeat', mood: 'joyful upbeat cheerful happy energetic', icon: PartyPopper, gradient: 'from-yellow-500 to-amber-500', iconColor: 'text-yellow-100' },
  { id: 'nostalgic', name: 'Nostalgic', mood: 'nostalgic sentimental bittersweet wistful', icon: Rewind, gradient: 'from-orange-500 to-amber-700', iconColor: 'text-orange-100' },
  { id: 'intense-thrilling', name: 'Intense & Thrilling', mood: 'intense thrilling adrenaline-pumping suspenseful', icon: Flame, gradient: 'from-red-600 to-orange-700', iconColor: 'text-red-200' },
  { id: 'peaceful-serene', name: 'Peaceful & Serene', mood: 'peaceful serene calm tranquil meditative', icon: Feather, gradient: 'from-emerald-500 to-teal-600', iconColor: 'text-emerald-100' },
  { id: 'romantic', name: 'Romantic', mood: 'romantic love passion heartfelt tender', icon: Heart, gradient: 'from-pink-500 to-rose-600', iconColor: 'text-pink-100' },
]

// --- Theme Card Definitions ---

interface ThemeCard {
  id: string
  name: string
  theme: string
  icon: React.ElementType
  gradient: string
  iconColor: string
}

const THEME_CARDS: ThemeCard[] = [
  { id: 'coming-of-age', name: 'Coming of Age', theme: 'coming of age growing up self-discovery maturation', icon: Baby, gradient: 'from-sky-500 to-cyan-600', iconColor: 'text-sky-100' },
  { id: 'redemption', name: 'Redemption Stories', theme: 'redemption atonement second chances forgiveness', icon: ArrowUpFromLine, gradient: 'from-violet-600 to-purple-700', iconColor: 'text-violet-200' },
  { id: 'underdog', name: 'Underdog Victory', theme: 'underdog victory overcoming odds perseverance triumph', icon: Trophy, gradient: 'from-amber-500 to-yellow-600', iconColor: 'text-amber-100' },
  { id: 'love-conquers', name: 'Love Conquers All', theme: 'love conquers all romance devotion sacrifice for love', icon: HeartHandshake, gradient: 'from-rose-500 to-pink-600', iconColor: 'text-rose-100' },
  { id: 'man-vs-nature', name: 'Man vs Nature', theme: 'man versus nature survival wilderness elements', icon: TreePine, gradient: 'from-emerald-600 to-green-700', iconColor: 'text-emerald-100' },
  { id: 'tech-humanity', name: 'Technology & Humanity', theme: 'technology humanity artificial intelligence cyberpunk future society', icon: Cpu, gradient: 'from-cyan-600 to-teal-700', iconColor: 'text-cyan-100' },
  { id: 'family-bonds', name: 'Family Bonds', theme: 'family bonds kinship parenthood sibling relationships', icon: Users, gradient: 'from-orange-500 to-red-500', iconColor: 'text-orange-100' },
  { id: 'betrayal-revenge', name: 'Betrayal & Revenge', theme: 'betrayal revenge vengeance deception backstabbing', icon: Skull, gradient: 'from-red-700 to-rose-900', iconColor: 'text-red-200' },
]

// --- Semantic Example Chips ---

const SEMANTIC_EXAMPLES = [
  'Movies where humanity overcomes impossible odds',
  'Music with strong female vocals and emotional lyrics',
  'Feel-good movies that aren\'t comedies',
  'Dark and atmospheric sci-fi',
]

export function SemanticDiscovery({ onPlay }: SemanticDiscoveryProps) {
  const [activeTab, setActiveTab] = useState('semantic')
  const [semanticQuery, setSemanticQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<MediaItem[]>([])
  const [interpretation, setInterpretation] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeMoodId, setActiveMoodId] = useState<string | null>(null)
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)

  const handleSearch = useCallback(async (
    query: string,
    discoveryType: 'semantic' | 'mood' | 'thematic'
  ) => {
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const res = await fetch('/api/ai/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, discoveryType }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to search')
      }

      const data = await res.json()
      setResults(data.items || [])
      setInterpretation(data.interpretation || '')
      setThemes(data.themes || [])
      setSuggestions(data.suggestions || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setResults([])
      setInterpretation('')
      setThemes([])
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSemanticSubmit = useCallback(() => {
    if (!semanticQuery.trim()) return
    handleSearch(semanticQuery, 'semantic')
  }, [semanticQuery, handleSearch])

  const handleMoodClick = useCallback((mood: MoodCard) => {
    setActiveMoodId(mood.id)
    setActiveThemeId(null)
    handleSearch(mood.mood, 'mood')
  }, [handleSearch])

  const handleThemeClick = useCallback((theme: ThemeCard) => {
    setActiveThemeId(theme.id)
    setActiveMoodId(null)
    handleSearch(theme.theme, 'thematic')
  }, [handleSearch])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSemanticQuery(suggestion)
    handleSearch(suggestion, 'semantic')
  }, [handleSearch])

  const handleRetry = useCallback(() => {
    setError(null)
    if (activeMoodId) {
      const mood = MOOD_CARDS.find(m => m.id === activeMoodId)
      if (mood) handleSearch(mood.mood, 'mood')
    } else if (activeThemeId) {
      const theme = THEME_CARDS.find(t => t.id === activeThemeId)
      if (theme) handleSearch(theme.theme, 'thematic')
    } else {
      handleSearch(semanticQuery, 'semantic')
    }
  }, [activeMoodId, activeThemeId, semanticQuery, handleSearch])

  return (
    <div className="px-6 mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/15">
          <Brain className="h-4.5 w-4.5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">AI Discovery</h2>
          <p className="text-[11px] text-muted-foreground/60">Explore your library by concept, mood, and theme</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 mb-5">
          <TabsTrigger value="semantic" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Semantic
          </TabsTrigger>
          <TabsTrigger value="mood" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Heart className="h-3.5 w-3.5 mr-1.5" />
            By Mood
          </TabsTrigger>
          <TabsTrigger value="theme" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
            <Palette className="h-3.5 w-3.5 mr-1.5" />
            By Theme
          </TabsTrigger>
        </TabsList>

        {/* Semantic Tab */}
        <TabsContent value="semantic" className="mt-0">
          <div className={cn(
            "rounded-xl p-5",
            "bg-gradient-to-br from-purple-500/8 via-pink-500/5 to-purple-600/5",
            "border border-purple-500/15"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200">Conceptual Search</h3>
            </div>
            <div className="flex gap-2 mb-4">
              <Input
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSemanticSubmit()}
                placeholder="Describe what you're looking for conceptually..."
                disabled={isLoading}
                className={cn(
                  "h-11 bg-white/5 border-purple-500/20 focus:border-purple-400/50",
                  "placeholder:text-muted-foreground/40",
                  "rounded-lg backdrop-blur-sm"
                )}
              />
              <Button
                onClick={handleSemanticSubmit}
                disabled={isLoading || !semanticQuery.trim()}
                className={cn(
                  "h-11 px-5 rounded-lg font-semibold gap-1.5 shrink-0",
                  "bg-gradient-to-r from-purple-500 to-pink-500",
                  "hover:from-purple-600 hover:to-pink-600",
                  "shadow-lg shadow-purple-500/25",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SEMANTIC_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setSemanticQuery(example)
                    handleSearch(example, 'semantic')
                  }}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-purple-500/15 text-muted-foreground/60 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/25 transition-all duration-200 cursor-pointer disabled:opacity-40"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Mood Tab */}
        <TabsContent value="mood" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MOOD_CARDS.map((mood) => {
              const Icon = mood.icon
              const isActive = activeMoodId === mood.id
              return (
                <button
                  key={mood.id}
                  onClick={() => handleMoodClick(mood)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-br",
                    mood.gradient,
                    "transition-all duration-300",
                    "hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isActive && "ring-2 ring-white/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-xl -translate-y-1/3 translate-x-1/3" />
                  <div className="relative z-10">
                    <Icon className={cn("h-6 w-6 mb-2", mood.iconColor)} />
                    <p className="text-sm font-semibold text-white/90 leading-tight">{mood.name}</p>
                    {isLoading && isActive && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-[10px] text-white/60">Searching...</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {THEME_CARDS.map((theme) => {
              const Icon = theme.icon
              const isActive = activeThemeId === theme.id
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeClick(theme)}
                  disabled={isLoading}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4 text-left",
                    "bg-gradient-to-br",
                    theme.gradient,
                    "transition-all duration-300",
                    "hover:scale-[1.03] hover:shadow-lg hover:shadow-black/30",
                    "active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isActive && "ring-2 ring-white/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-xl -translate-y-1/3 translate-x-1/3" />
                  <div className="relative z-10">
                    <Icon className={cn("h-6 w-6 mb-2", theme.iconColor)} />
                    <p className="text-sm font-semibold text-white/90 leading-tight">{theme.name}</p>
                    {isLoading && isActive && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-[10px] text-white/60">Searching...</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Results Area */}
      {hasSearched && (
        <div className="mt-5">
          {/* Interpretation Badge */}
          {interpretation && !isLoading && !error && (
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs gap-1.5 py-1"
              >
                <Lightbulb className="h-3 w-3" />
                {interpretation}
              </Badge>
            </div>
          )}

          {/* Theme Badges */}
          {themes.length > 0 && !isLoading && !error && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Tag className="h-3.5 w-3.5 text-muted-foreground/40 self-center" />
              {themes.map((theme, i) => (
                <Badge
                  key={`${theme}-${i}`}
                  variant="outline"
                  className="bg-pink-500/10 text-pink-300 border-pink-500/20 text-[10px] px-2 py-0 h-5 gap-1"
                >
                  {theme}
                </Badge>
              ))}
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
              <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">No matches found. Try a different concept, mood, or theme.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
