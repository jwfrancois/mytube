'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Upload, Menu, Bell, User, Server, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onSearch: () => void
}

export function Header({ onSearch }: HeaderProps) {
  const { searchQuery, setSearchQuery, toggleSidebar, setAddDialogOpen, jellyfinConnected, setActiveCategory } = useAppStore()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  return (
    <header
      className={cn(
        "h-14 flex items-center justify-between px-4 sticky top-0 z-50 shrink-0 transition-all duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border/50 shadow-lg shadow-black/10"
          : "bg-background/80 backdrop-blur-sm border-b border-transparent"
      )}
    >
      {/* Left: Menu + Logo */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0 h-9 w-9">
          <Menu className="h-5 w-5" />
        </Button>
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => {
            useAppStore.setState({ currentMedia: null, searchQuery: '', isSearching: false, activeCategory: 'ALL' })
          }}
        >
          <div className="w-8 h-8 bg-mythic rounded-lg flex items-center justify-center shadow-lg shadow-mythic/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-mythic-foreground fill-current">
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold hidden sm:inline tracking-tight">MyTube</span>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex items-center max-w-2xl flex-1 mx-4">
        <div className="flex w-full">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search movies, shows, music..."
            className="rounded-r-none border-r-0 bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-mythic/50 focus-visible:bg-white/8 placeholder:text-muted-foreground/50 transition-colors h-9"
          />
          <Button
            onClick={onSearch}
            variant="secondary"
            className="rounded-l-none border border-white/10 bg-white/10 hover:bg-white/15 text-foreground px-5 h-9"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Jellyfin NAS - prominent clickable button */}
        <Button
          variant="ghost"
          className={cn(
            "gap-2 h-9 px-3 transition-all duration-200",
            jellyfinConnected
              ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
              : "text-muted-foreground hover:bg-muted border border-border"
          )}
          onClick={() => {
            useAppStore.setState({ currentMedia: null, searchQuery: '', isSearching: false })
            setActiveCategory('JELLYFIN')
          }}
          title={jellyfinConnected ? 'Open Jellyfin NAS' : 'Jellyfin NAS - Not connected'}
        >
          <Server className="h-4 w-4" />
          <span className="hidden sm:inline text-sm font-medium">NAS</span>
          {jellyfinConnected ? (
            <Wifi className="h-3 w-3 text-emerald-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-muted-foreground/50" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          title="Add Media"
          onClick={() => setAddDialogOpen(true)}
          className="h-9 w-9"
        >
          <Upload className="h-4.5 w-4.5" />
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:flex h-9 w-9">
          <Bell className="h-4.5 w-4.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <User className="h-4.5 w-4.5" />
        </Button>
      </div>
    </header>
  )
}
