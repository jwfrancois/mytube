'use client'

import { Server, Heart, Github } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

export function Footer() {
  const { jellyfinConnected, jellyfinServer } = useAppStore()

  return (
    <footer className="border-t border-border/50 mt-12 py-6 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} MyTube</span>
            <span className="text-muted-foreground/30">•</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" />
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">About</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1">
              <Github className="h-3 w-3" />
              Source
            </span>
          </div>

          {jellyfinConnected && jellyfinServer && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500/70">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Server className="h-3 w-3" />
              <span>{jellyfinServer.name || 'Jellyfin'} Connected</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
