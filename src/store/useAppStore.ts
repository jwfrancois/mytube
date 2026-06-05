import { create } from 'zustand'

export type MediaType = 'ALL' | 'MOVIE' | 'TV_SHOW' | 'MUSIC'
export type SortType = 'recent' | 'popular'

interface MediaItem {
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
}

export const useAppStore = create<AppState>((set) => ({
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
  setCurrentMedia: (media) => set({ currentMedia: media, isPlaying: !!media }),
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
}))
