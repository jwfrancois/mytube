'use client'

import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Upload, Menu, Bell, User } from 'lucide-react'

interface HeaderProps {
  onSearch: () => void
}

export function Header({ onSearch }: HeaderProps) {
  const { searchQuery, setSearchQuery, toggleSidebar, setAddDialogOpen } = useAppStore()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background sticky top-0 z-50 shrink-0">
      {/* Left: Menu + Logo */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={() => {
            useAppStore.setState({ currentMedia: null, searchQuery: '', isSearching: false, activeCategory: 'ALL' })
          }}
        >
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
          <span className="text-lg font-bold hidden sm:inline">MyTube</span>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex items-center max-w-2xl flex-1 mx-4">
        <div className="flex w-full">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search videos, shows, music..."
            className="rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            onClick={onSearch}
            variant="secondary"
            className="rounded-l-none border border-input px-4"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title="Add Media"
          onClick={() => setAddDialogOpen(true)}
        >
          <Upload className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:flex">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
