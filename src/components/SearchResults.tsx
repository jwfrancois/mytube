'use client'

import { useAppStore } from '@/store/useAppStore'
import { MediaCard } from '@/components/MediaCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, X } from 'lucide-react'

interface SearchResultsProps {
  onSearch: () => void
}

export function SearchResults({ onSearch }: SearchResultsProps) {
  const { searchQuery, searchResults, isSearching, setSearchQuery, setIsSearching, setCurrentMedia } = useAppStore()

  const handleClear = () => {
    setSearchQuery('')
    setIsSearching(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">
            Search results for &quot;{searchQuery}&quot;
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1">
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {isSearching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searchResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {searchResults.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-1">Try different keywords or check the spelling</p>
        </div>
      )}
    </div>
  )
}
