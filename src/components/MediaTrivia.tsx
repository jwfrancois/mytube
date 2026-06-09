'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWatchHistory } from '@/hooks/useWatchHistory'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Lightbulb,
  Brain,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunFact {
  fact: string
  relatedTitle: string
  category: string
}

interface QuizQuestion {
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  relatedTitle: string
}

type TriviaMode = 'facts' | 'quiz'

// ── Accent colors for fact cards ──────────────────────────────────────────────

const FACT_ACCENTS = [
  { border: 'from-emerald-500/40 to-emerald-600/20', bg: 'from-emerald-500/10 to-emerald-600/5', text: 'text-emerald-300', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  { border: 'from-amber-500/40 to-amber-600/20', bg: 'from-amber-500/10 to-amber-600/5', text: 'text-amber-300', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  { border: 'from-rose-500/40 to-rose-600/20', bg: 'from-rose-500/10 to-rose-600/5', text: 'text-rose-300', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25' },
  { border: 'from-cyan-500/40 to-cyan-600/20', bg: 'from-cyan-500/10 to-cyan-600/5', text: 'text-cyan-300', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
  { border: 'from-purple-500/40 to-purple-600/20', bg: 'from-purple-500/10 to-purple-600/5', text: 'text-purple-300', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function MediaTrivia() {
  const { watchHistory } = useWatchHistory()
  const [mode, setMode] = useState<TriviaMode>('facts')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Facts state
  const [facts, setFacts] = useState<FunFact[]>([])
  const [currentFactIndex, setCurrentFactIndex] = useState(0)
  const [factFlipped, setFactFlipped] = useState(false)
  const factTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [quizComplete, setQuizComplete] = useState(false)

  // Whether we've attempted a fetch
  const [hasFetched, setHasFetched] = useState(false)

  // ── Fetch trivia ──────────────────────────────────────────────────────────
  const fetchTrivia = useCallback(async (targetMode: TriviaMode) => {
    if (watchHistory.length === 0) return

    setIsLoading(true)
    setError(null)

    // Reset states
    if (targetMode === 'facts') {
      setCurrentFactIndex(0)
      setFactFlipped(false)
    } else {
      setCurrentQuestionIndex(0)
      setSelectedAnswer(null)
      setScore(0)
      setQuizComplete(false)
    }

    try {
      const historyPayload = watchHistory.slice(0, 20).map((item) => ({
        title: item.title,
        type: item.type,
        genre: item.genre,
      }))

      const res = await fetch('/api/ai/trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: historyPayload, mode: targetMode }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate trivia')
      }

      const data = await res.json()

      if (targetMode === 'facts') {
        setFacts(data.items || [])
      } else {
        setQuestions(data.items || [])
      }

      setHasFetched(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [watchHistory])

  // ── Auto-load on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (watchHistory.length > 0 && !hasFetched) {
      fetchTrivia(mode)
    }
  }, [watchHistory.length, hasFetched, mode, fetchTrivia])

  // ── Auto-rotate facts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'facts' || facts.length === 0 || isLoading) return

    // Clear any existing timer
    if (factTimerRef.current) {
      clearInterval(factTimerRef.current)
    }

    factTimerRef.current = setInterval(() => {
      setFactFlipped(true)
      setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % facts.length)
        setFactFlipped(false)
      }, 300)
    }, 8000)

    return () => {
      if (factTimerRef.current) {
        clearInterval(factTimerRef.current)
      }
    }
  }, [mode, facts, isLoading])

  // ── Handle tab change ─────────────────────────────────────────────────────
  const handleTabChange = useCallback((value: string) => {
    const newMode = value as TriviaMode
    setMode(newMode)
    setError(null)
    fetchTrivia(newMode)
  }, [fetchTrivia])

  // ── Handle fact advance ───────────────────────────────────────────────────
  const handleNextFact = useCallback(() => {
    if (facts.length === 0) return
    setFactFlipped(true)
    setTimeout(() => {
      setCurrentFactIndex((prev) => (prev + 1) % facts.length)
      setFactFlipped(false)
    }, 300)
  }, [facts.length])

  // ── Handle quiz answer ────────────────────────────────────────────────────
  const handleAnswer = useCallback((index: number) => {
    if (selectedAnswer !== null) return // Already answered
    setSelectedAnswer(index)

    if (index === questions[currentQuestionIndex].correctIndex) {
      setScore((prev) => prev + 1)
    }
  }, [selectedAnswer, questions, currentQuestionIndex])

  // ── Handle next question ──────────────────────────────────────────────────
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex + 1 >= questions.length) {
      setQuizComplete(true)
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      setSelectedAnswer(null)
    }
  }, [currentQuestionIndex, questions.length])

  // ── Handle regenerate ─────────────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    fetchTrivia(mode)
  }, [mode, fetchTrivia])

  // ── Empty watch history ───────────────────────────────────────────────────
  if (watchHistory.length === 0) {
    return (
      <div className="px-6 mb-8">
        <div className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-gradient-to-br from-emerald-500/10 via-amber-500/8 to-rose-500/5",
          "border border-white/10",
          "backdrop-blur-xl shadow-2xl"
        )}>
          <div className="relative z-10 p-8 sm:p-10 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/15 mx-auto mb-4">
              <Brain className="h-7 w-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Media Trivia</h2>
            <p className="text-sm text-muted-foreground/60">
              Watch something first! We&apos;ll generate fun facts and quiz questions based on your watch history.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 mb-8">
      {/* Glassmorphism Panel */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-emerald-500/10 via-amber-500/8 to-rose-500/5",
        "border border-white/10",
        "backdrop-blur-xl shadow-2xl"
      )}>
        {/* Subtle gradient decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 shadow-lg shadow-amber-500/25">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">
                  Media Trivia
                </h2>
                <p className="text-xs text-muted-foreground/70">Fun facts & quizzes about your media</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isLoading}
              className={cn(
                "gap-1.5 text-muted-foreground/60 hover:text-amber-300",
                "hover:bg-amber-500/10 rounded-xl",
                "transition-all duration-200"
              )}
            >
              <RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              <span className="hidden sm:inline">New Trivia</span>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={handleTabChange} className="w-full">
            <TabsList className={cn(
              "mb-6 w-full sm:w-auto",
              "bg-white/5 border border-white/10",
              "rounded-xl p-1 h-auto"
            )}>
              <TabsTrigger
                value="facts"
                className={cn(
                  "flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-amber-500/20",
                  "data-[state=active]:text-emerald-300",
                  "transition-all duration-200"
                )}
              >
                <Lightbulb className="h-4 w-4" />
                Fun Facts
              </TabsTrigger>
              <TabsTrigger
                value="quiz"
                className={cn(
                  "flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm",
                  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-rose-500/20",
                  "data-[state=active]:text-amber-300",
                  "transition-all duration-200"
                )}
              >
                <Brain className="h-4 w-4" />
                Quiz
              </TabsTrigger>
            </TabsList>

            {/* Facts Tab */}
            <TabsContent value="facts" className="mt-0">
              {renderFactsContent()}
            </TabsContent>

            {/* Quiz Tab */}
            <TabsContent value="quiz" className="mt-0">
              {renderQuizContent()}
            </TabsContent>
          </Tabs>

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15 mt-4">
              <X className="h-5 w-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                className="shrink-0 text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Render: Facts Content ────────────────────────────────────────────────
  function renderFactsContent() {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="w-full max-w-lg">
              <Skeleton className="h-48 w-full rounded-2xl shimmer" />
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-2 w-2 rounded-full shimmer" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (facts.length === 0) return null

    const currentFact = facts[currentFactIndex]
    const accent = FACT_ACCENTS[currentFactIndex % FACT_ACCENTS.length]

    return (
      <div className="flex flex-col items-center">
        {/* Fact Card */}
        <div
          className={cn(
            "w-full max-w-lg cursor-pointer",
            "transition-all duration-300 ease-out",
            factFlipped ? "scale-95 opacity-0" : "scale-100 opacity-100"
          )}
          onClick={handleNextFact}
        >
          <div className={cn(
            "relative overflow-hidden rounded-2xl p-1",
            "bg-gradient-to-br",
            accent.border
          )}>
            {/* Inner card */}
            <div className={cn(
              "rounded-xl p-6 sm:p-8",
              "bg-gradient-to-br",
              accent.bg,
              "backdrop-blur-sm",
              "min-h-[200px] flex flex-col justify-between"
            )}>
              {/* Category & Title badge */}
              <div className="flex items-center justify-between mb-4">
                <Badge
                  variant="outline"
                  className={cn("text-xs gap-1.5 py-1 px-2.5 border", accent.badge)}
                >
                  <Lightbulb className="h-3 w-3" />
                  {currentFact.category}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] py-1 px-2 bg-white/5 border-white/10 text-muted-foreground/70"
                >
                  {currentFact.relatedTitle}
                </Badge>
              </div>

              {/* Fact text */}
              <p className={cn("text-base sm:text-lg font-medium leading-relaxed", accent.text)}>
                {currentFact.fact}
              </p>

              {/* Indicator */}
              <div className="flex items-center justify-between mt-5">
                <div className="flex gap-2">
                  {facts.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        i === currentFactIndex
                          ? cn("w-6", accent.text.replace('text-', 'bg-'))
                          : "bg-white/15"
                      )}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  {currentFactIndex + 1}/{facts.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Click hint */}
        <p className="text-[11px] text-muted-foreground/30 mt-3">
          Click card or wait 8s for next fact
        </p>
      </div>
    )
  }

  // ── Render: Quiz Content ─────────────────────────────────────────────────
  function renderQuizContent() {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-24 rounded-lg shimmer" />
            <Skeleton className="h-6 w-16 rounded-lg shimmer" />
          </div>
          <Skeleton className="h-6 w-full rounded-lg shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl shimmer" />
            ))}
          </div>
        </div>
      )
    }

    if (questions.length === 0) return null

    // Quiz complete
    if (quizComplete) {
      const percentage = Math.round((score / questions.length) * 100)
      const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '👏' : percentage >= 40 ? '🤔' : '💪'

      return (
        <div className="flex flex-col items-center py-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/20 flex items-center justify-center mb-4">
            <Trophy className="h-10 w-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-bold mb-1">
            {emoji} {score}/{questions.length}
          </h3>
          <p className="text-sm text-muted-foreground/60 mb-6">
            {percentage >= 80
              ? 'Amazing! You\'re a media genius!'
              : percentage >= 60
                ? 'Great job! You know your stuff!'
                : percentage >= 40
                  ? 'Not bad! Keep watching and learning!'
                  : 'Keep exploring! You\'ll get better!'}
          </p>
          <Button
            onClick={handleRegenerate}
            className={cn(
              "gap-2 rounded-xl",
              "bg-gradient-to-r from-amber-500 to-rose-500",
              "hover:from-amber-600 hover:to-rose-600",
              "shadow-lg shadow-amber-500/25",
              "transition-all duration-300"
            )}
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
        </div>
      )
    }

    const currentQuestion = questions[currentQuestionIndex]
    const hasAnswered = selectedAnswer !== null
    const isCorrect = hasAnswered && selectedAnswer === currentQuestion.correctIndex

    return (
      <div>
        {/* Score & Progress */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              {score}/{questions.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground/50">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentQuestionIndex + (hasAnswered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>

        {/* Related Title Badge */}
        <Badge
          variant="outline"
          className="text-[10px] py-1 px-2 mb-4 bg-white/5 border-white/10 text-muted-foreground/60"
        >
          {currentQuestion.relatedTitle}
        </Badge>

        {/* Question */}
        <h3 className="text-lg sm:text-xl font-semibold mb-5 leading-snug">
          {currentQuestion.question}
        </h3>

        {/* Options */}
        <div className="space-y-3 mb-5">
          {currentQuestion.options.map((option, i) => {
            const isSelected = selectedAnswer === i
            const isCorrectOption = i === currentQuestion.correctIndex
            const showResult = hasAnswered

            let optionClasses = cn(
              "w-full text-left px-5 py-3.5 rounded-xl border",
              "transition-all duration-300",
              "text-sm font-medium",
            )

            if (showResult && isCorrectOption) {
              optionClasses = cn(optionClasses,
                "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
              )
            } else if (showResult && isSelected && !isCorrectOption) {
              optionClasses = cn(optionClasses,
                "bg-red-500/20 border-red-500/50 text-red-300"
              )
            } else if (showResult && !isCorrectOption) {
              optionClasses = cn(optionClasses,
                "bg-white/3 border-white/5 text-muted-foreground/30"
              )
            } else if (isSelected) {
              optionClasses = cn(optionClasses,
                "bg-amber-500/15 border-amber-500/40 text-amber-200"
              )
            } else {
              optionClasses = cn(optionClasses,
                "bg-white/5 border-white/10 text-foreground/80",
                "hover:bg-white/8 hover:border-white/20",
                "cursor-pointer"
              )
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={hasAnswered}
                className={cn(optionClasses, "flex items-center gap-3")}
              >
                {/* Option letter */}
                <span className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                  showResult && isCorrectOption
                    ? "bg-emerald-500/30 text-emerald-300"
                    : showResult && isSelected && !isCorrectOption
                      ? "bg-red-500/30 text-red-300"
                      : "bg-white/5 text-muted-foreground/50"
                )}>
                  {showResult && isCorrectOption ? (
                    <Check className="h-4 w-4" />
                  ) : showResult && isSelected && !isCorrectOption ? (
                    <X className="h-4 w-4" />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            )
          })}
        </div>

        {/* Explanation & Next button */}
        {hasAnswered && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Explanation */}
            <div className={cn(
              "p-4 rounded-xl border",
              isCorrect
                ? "bg-emerald-500/5 border-emerald-500/15"
                : "bg-amber-500/5 border-amber-500/15"
            )}>
              <div className="flex items-start gap-2">
                {isCorrect ? (
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn(
                    "text-xs font-semibold mb-1",
                    isCorrect ? "text-emerald-300" : "text-amber-300"
                  )}>
                    {isCorrect ? 'Correct!' : 'Not quite!'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* Next Question button */}
            <Button
              onClick={handleNextQuestion}
              className={cn(
                "w-full gap-2 rounded-xl",
                "bg-gradient-to-r from-amber-500 to-rose-500",
                "hover:from-amber-600 hover:to-rose-600",
                "shadow-lg shadow-amber-500/15",
                "transition-all duration-300"
              )}
            >
              {currentQuestionIndex + 1 >= questions.length ? (
                <>
                  <Trophy className="h-4 w-4" />
                  See Results
                </>
              ) : (
                <>
                  Next Question
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }
}
