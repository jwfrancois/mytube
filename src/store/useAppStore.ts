import { create } from 'zustand'

export type MediaType = 'ALL' | 'MOVIE' | 'TV_SHOW' | 'MUSIC' | 'PODCAST' | 'AUDIOBOOK' | 'COLLECTION' | 'JELLYFIN'
export type SortType = 'recent' | 'popular'

export interface MediaItem {
  id: string
  title: string
  description: string
  type: string
  genre: string
  thumbnail: string
  videoUrl: string
  duration: string
  releaseYear: number
  artist: string
  views: number
  channel: string
  createdAt: string
  isJellyfin?: boolean
  jellyfinId?: string
  mediaSourceId?: string
  itemType?: string
  parentId?: string
  hasChildren?: boolean
  communityRating?: number
  indexNumber?: number
  parentIndexNumber?: number
  collectionType?: string
  childCount?: number
}

interface JellyfinServerInfo {
  id: string
  name: string
  serverUrl: string
  username: string
  connected: boolean
  lastConnected: string | null
}

function isAudioType(type: string): boolean {
  return ['MUSIC', 'PODCAST', 'AUDIOBOOK'].includes(type)
}

interface AppState {
  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Category / Filter
  activeCategory: MediaType
  setActiveCategory: (cat: MediaType) => void
  activeGenre: string
  setActiveGenre: (genre: string) => void
  sortBy: SortType
  setSortBy: (sort: SortType) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: MediaItem[]
  setSearchResults: (results: MediaItem[]) => void
  isSearching: boolean
  setIsSearching: (searching: boolean) => void

  // Player
  currentMedia: MediaItem | null
  setCurrentMedia: (media: MediaItem | null) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  // Media data
  mediaItems: MediaItem[]
  setMediaItems: (items: MediaItem[]) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Add media dialog
  addDialogOpen: boolean
  setAddDialogOpen: (open: boolean) => void

  // Settings dialog
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  // Jellyfin
  jellyfinConnected: boolean
  setJellyfinConnected: (connected: boolean) => void
  jellyfinServer: JellyfinServerInfo | null
  setJellyfinServer: (server: JellyfinServerInfo | null) => void
  jellyfinItems: MediaItem[]
  setJellyfinItems: (items: MediaItem[]) => void
  jellyfinLoading: boolean
  setJellyfinLoading: (loading: boolean) => void
  jellyfinBreadcrumbs: { id: string; title: string; collectionType?: string }[]
  setJellyfinBreadcrumbs: (breadcrumbs: { id: string; title: string; collectionType?: string }[]) => void

  // Audio Player Queue
  audioQueue: MediaItem[]
  audioQueueIndex: number
  setAudioQueue: (items: MediaItem[]) => void
  setAudioQueueIndex: (index: number) => void
  addToAudioQueue: (item: MediaItem) => void
  removeFromAudioQueue: (index: number) => void
  clearAudioQueue: () => void
  playNext: () => void
  playPrevious: () => void

  // Audio Settings
  volume: number
  setVolume: (v: number) => void
  playbackSpeed: number
  setPlaybackSpeed: (speed: number) => void
  equalizerPreset: string
  setEqualizerPreset: (preset: string) => void
  shuffleEnabled: boolean
  setShuffleEnabled: (enabled: boolean) => void
  repeatMode: 'none' | 'all' | 'one'
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void

  // Knowledge Graph view
  showKnowledgeGraph: boolean
  setShowKnowledgeGraph: (show: boolean) => void

  // Persistent Audio Track (decoupled from currentMedia for background playback)
  audioTrack: MediaItem | null
  setAudioTrack: (track: MediaItem | null) => void
  audioCurrentTime: number
  setAudioCurrentTime: (time: number) => void
  audioDuration: number
  setAudioDuration: (duration: number) => void
  audioElement: HTMLAudioElement | null
  setAudioElement: (el: HTMLAudioElement | null) => void
  stopAudio: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Category
  activeCategory: 'ALL',
  setActiveCategory: (cat) => set({ activeCategory: cat, activeGenre: '' }),
  activeGenre: '',
  setActiveGenre: (genre) => set({ activeGenre: genre }),
  sortBy: 'recent',
  setSortBy: (sort) => set({ sortBy: sort }),

  // Search
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),
  isSearching: false,
  setIsSearching: (searching) => set({ isSearching: searching }),

  // Player
  currentMedia: null,
  setCurrentMedia: (media) => {
    if (media && isAudioType(media.type)) {
      // When setting an audio media, also set the persistent audio track
      set({ currentMedia: media, isPlaying: !!media, audioTrack: media })
    } else if (!media) {
      // Clearing currentMedia (going back) — keep audioTrack for background playback
      set({ currentMedia: null })
    } else {
      // Non-audio media (video) — stop background audio
      set({ currentMedia: media, isPlaying: !!media, audioTrack: null })
    }
  },
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // Media data
  mediaItems: [],
  setMediaItems: (items) => set({ mediaItems: items }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Add media dialog
  addDialogOpen: false,
  setAddDialogOpen: (open) => set({ addDialogOpen: open }),

  // Settings dialog
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  // Jellyfin
  jellyfinConnected: false,
  setJellyfinConnected: (connected) => set({ jellyfinConnected: connected }),
  jellyfinServer: null,
  setJellyfinServer: (server) => set({ jellyfinServer: server }),
  jellyfinItems: [],
  setJellyfinItems: (items) => set({ jellyfinItems: items }),
  jellyfinLoading: false,
  setJellyfinLoading: (loading) => set({ jellyfinLoading: loading }),
  jellyfinBreadcrumbs: [],
  setJellyfinBreadcrumbs: (breadcrumbs) => set({ jellyfinBreadcrumbs: breadcrumbs }),

  // Audio Player Queue
  audioQueue: [],
  audioQueueIndex: -1,
  setAudioQueue: (items) => set({ audioQueue: items, audioQueueIndex: items.length > 0 ? 0 : -1 }),
  setAudioQueueIndex: (index) => set({ audioQueueIndex: index }),
  addToAudioQueue: (item) => set((s) => ({ audioQueue: [...s.audioQueue, item] })),
  removeFromAudioQueue: (index) => set((s) => {
    const newQueue = [...s.audioQueue]
    newQueue.splice(index, 1)
    let newIndex = s.audioQueueIndex
    if (index < s.audioQueueIndex) {
      newIndex = s.audioQueueIndex - 1
    } else if (index === s.audioQueueIndex) {
      newIndex = Math.min(s.audioQueueIndex, newQueue.length - 1)
    }
    return { audioQueue: newQueue, audioQueueIndex: newIndex }
  }),
  clearAudioQueue: () => set({ audioQueue: [], audioQueueIndex: -1 }),
  playNext: () => set((s) => {
    if (s.audioQueue.length === 0) return { audioQueueIndex: -1 }

    if (s.repeatMode === 'one') {
      // Stay on the same track — caller is responsible for restarting playback
      return { audioQueueIndex: s.audioQueueIndex }
    }

    let nextIndex = s.audioQueueIndex + 1
    if (nextIndex >= s.audioQueue.length) {
      if (s.repeatMode === 'all') {
        nextIndex = 0
      } else {
        // End of queue, no repeat
        return { audioQueueIndex: -1, isPlaying: false, audioTrack: null }
      }
    }

    // Shuffle: pick a random index different from current
    if (s.shuffleEnabled && s.audioQueue.length > 1) {
      let randomIndex = s.audioQueueIndex
      while (randomIndex === s.audioQueueIndex) {
        randomIndex = Math.floor(Math.random() * s.audioQueue.length)
      }
      nextIndex = randomIndex
    }

    const nextMedia = s.audioQueue[nextIndex]
    // Update audioTrack always, currentMedia only if currently showing audio view
    const isShowingAudioView = s.currentMedia && isAudioType(s.currentMedia.type)
    return {
      audioQueueIndex: nextIndex,
      audioTrack: nextMedia,
      ...(isShowingAudioView ? { currentMedia: nextMedia } : {}),
      isPlaying: true,
    }
  }),
  playPrevious: () => set((s) => {
    if (s.audioQueue.length === 0) return { audioQueueIndex: -1 }

    let prevIndex = s.audioQueueIndex - 1
    if (prevIndex < 0) {
      if (s.repeatMode === 'all') {
        prevIndex = s.audioQueue.length - 1
      } else {
        prevIndex = 0
      }
    }

    const prevMedia = s.audioQueue[prevIndex]
    const isShowingAudioView = s.currentMedia && isAudioType(s.currentMedia.type)
    return {
      audioQueueIndex: prevIndex,
      audioTrack: prevMedia,
      ...(isShowingAudioView ? { currentMedia: prevMedia } : {}),
      isPlaying: true,
    }
  }),

  // Audio Settings
  volume: 0.8,
  setVolume: (v) => set({ volume: v }),
  playbackSpeed: 1,
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  equalizerPreset: 'flat',
  setEqualizerPreset: (preset) => set({ equalizerPreset: preset }),
  shuffleEnabled: false,
  setShuffleEnabled: (enabled) => set({ shuffleEnabled: enabled }),
  repeatMode: 'none',
  setRepeatMode: (mode) => set({ repeatMode: mode }),

  // Persistent Audio Track
  audioTrack: null,
  setAudioTrack: (track) => set({ audioTrack: track }),
  audioCurrentTime: 0,
  setAudioCurrentTime: (time) => set({ audioCurrentTime: time }),
  audioDuration: 0,
  setAudioDuration: (duration) => set({ audioDuration: duration }),
  audioElement: null,
  setAudioElement: (el) => set({ audioElement: el }),
  stopAudio: () => set({
    audioTrack: null,
    audioCurrentTime: 0,
    audioDuration: 0,
    isPlaying: false,
    audioQueue: [],
    audioQueueIndex: -1,
  }),

  // Knowledge Graph
  showKnowledgeGraph: false,
  setShowKnowledgeGraph: (show) => set({ showKnowledgeGraph: show }),
}))
