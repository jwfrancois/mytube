'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore, MediaItem } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sparkles,
  X,
  Send,
  AlertTriangle,
  User,
  Bot,
  ChevronRight,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface CompanionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  spoilerWarning?: string
  relatedInfo?: string
  timestamp: number
}

interface AICompanionPanelProps {
  isOpen: boolean
  onToggle: () => void
}

// --- Quick Question Chips ---

const QUICK_QUESTIONS = [
  'Who is this actor?',
  'Explain this scene',
  'What happened previously?',
  'Fun facts about this movie',
]

// --- Component ---

export function AICompanionPanel({ isOpen, onToggle }: AICompanionPanelProps) {
  const currentMedia = useAppStore((s) => s.currentMedia)
  const [messages, setMessages] = useState<CompanionMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [spoilerProtection, setSpoilerProtection] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const askCompanion = useCallback(async (query: string) => {
    if (!query.trim() || !currentMedia) return

    const userMessage: CompanionMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Get current playback time from the store
      const currentTime = useAppStore.getState().audioCurrentTime || 0

      const res = await fetch('/api/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          itemId: currentMedia.jellyfinId || currentMedia.id,
          currentTime,
          spoilerProtection,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to get response')
      }

      const data = await res.json()

      const assistantMessage: CompanionMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'I couldn\'t find information about that.',
        spoilerWarning: data.spoilerWarning,
        relatedInfo: data.relatedInfo,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      const errorMessage: CompanionMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: err.message || 'Something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [currentMedia, spoilerProtection])

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isLoading) return
    askCompanion(inputValue)
  }, [inputValue, isLoading, askCompanion])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <>
      {/* Toggle Button - always visible on right edge */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          "absolute right-2 top-2 z-30 h-9 w-9 rounded-full",
          "bg-black/40 backdrop-blur-sm border border-white/10",
          "text-white/70 hover:text-white hover:bg-black/60",
          "transition-all duration-300",
          isOpen && "bg-purple-500/30 border-purple-400/30 text-purple-200"
        )}
        title={isOpen ? 'Close AI Companion' : 'Open AI Companion'}
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      {/* Side Panel */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 z-20",
          "flex flex-col",
          "bg-background/95 backdrop-blur-xl",
          "border-l border-white/10",
          "shadow-2xl shadow-black/40",
          "transition-all duration-300 ease-in-out",
          isOpen ? "w-80 lg:w-96 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-full overflow-hidden"
        )}
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between p-3 shrink-0",
              "border-b border-white/5",
              "bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent"
            )}>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                  <Sparkles className="h-3.5 w-3.5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">AI Companion</h3>
                  <p className="text-[10px] text-muted-foreground/60">
                    {currentMedia ? currentMedia.title : 'No content playing'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Spoiler Protection Toggle */}
                <button
                  onClick={() => setSpoilerProtection(!spoilerProtection)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                    spoilerProtection
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      : "bg-white/5 text-muted-foreground/50 border border-white/10"
                  )}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Spoiler {spoilerProtection ? 'Safe' : 'Off'}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-3">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground/70 mb-1">
                    Ask about what you&apos;re watching
                  </p>
                  <p className="text-xs text-muted-foreground/40 max-w-[200px]">
                    Get insights about actors, scenes, plot, and fun trivia
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center mt-0.5">
                      <Bot className="h-3 w-3 text-purple-300" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                      msg.role === 'user'
                        ? "bg-purple-500/20 text-purple-100 border border-purple-500/15"
                        : "bg-white/5 text-foreground/80 border border-white/5",
                      msg.role === 'assistant' && "border-l-2 border-l-purple-400/30"
                    )}
                  >
                    {/* Spoiler Warning Badge */}
                    {msg.spoilerWarning && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0 mb-1.5 gap-1"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Spoiler Warning
                      </Badge>
                    )}

                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Related Info */}
                    {msg.relatedInfo && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                          <Info className="h-2.5 w-2.5" />
                          {msg.relatedInfo}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center mt-0.5">
                    <Bot className="h-3 w-3 text-purple-300" />
                  </div>
                  <div className="bg-white/5 border border-white/5 border-l-2 border-l-purple-400/30 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground/40">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Question Chips */}
            <div className="px-3 pb-1.5 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => !isLoading && askCompanion(q)}
                    disabled={isLoading}
                    className={cn(
                      "px-2.5 py-1 text-[11px] rounded-full",
                      "bg-white/5 border border-white/10",
                      "text-muted-foreground/60 hover:text-purple-300",
                      "hover:bg-purple-500/10 hover:border-purple-500/20",
                      "transition-all duration-200 cursor-pointer",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-3 pt-1.5 shrink-0 border-t border-white/5">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this movie..."
                  disabled={isLoading || !currentMedia}
                  className={cn(
                    "h-9 text-sm",
                    "bg-white/5 border-white/10 focus:border-purple-400/50",
                    "placeholder:text-muted-foreground/30",
                    "rounded-lg backdrop-blur-sm"
                  )}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputValue.trim() || !currentMedia}
                  className={cn(
                    "h-9 w-9 p-0 rounded-lg shrink-0",
                    "bg-gradient-to-r from-purple-500 to-pink-500",
                    "hover:from-purple-600 hover:to-pink-600",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
