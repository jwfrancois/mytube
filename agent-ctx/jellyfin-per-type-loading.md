# Task: Modify Jellyfin fetching to use per-type independent loading

## Summary

Changed the Jellyfin catalog fetching from a single blocking `fetchJellyfinCatalog()` that fetches ALL types (causing 30-45s waits due to slow NAS) to 3 independent fetches (MOVIE, TV_SHOW, MUSIC) with individual loading states. Each content type now appears independently as it loads, so Music (which loads in ~15s) shows immediately while Movies/TV Shows continue loading in the background.

## Changes Made

### 1. `/home/z/my-project/src/store/useAppStore.ts`
- Added 3 new state fields: `jellyfinMoviesLoading`, `jellyfinTVShowsLoading`, `jellyfinMusicLoading`
- Added their corresponding setters: `setJellyfinMoviesLoading`, `setJellyfinTVShowsLoading`, `setJellyfinMusicLoading`
- All existing fields preserved unchanged

### 2. `/home/z/my-project/src/app/page.tsx`
- Replaced single `fetchJellyfinCatalog()` with `fetchJellyfinType(type)` that fetches one type at a time
- Each type fetch manages its own loading state independently
- Uses `useAppStore.getState()` to safely merge items into `jellyfinCatalogItems` without stale closures
- `getJellyfinTypesToFetch()` determines which types to fetch based on `activeCategory` (ALL → all 3, specific → just that one, JELLYFIN → none)
- On category change: clears stale items of types being re-fetched, fires all fetches in parallel
- Passes per-type loading props to MediaGrid instead of single `jellyfinLoading`

### 3. `/home/z/my-project/src/components/MediaGrid.tsx`
- Updated props: replaced `jellyfinLoading` with `jellyfinMoviesLoading`, `jellyfinTVShowsLoading`, `jellyfinMusicLoading`
- NAS sections (Movies, TV Shows, Music) now show even while loading
- Each section displays a loading badge with spinner + text (e.g., "Loading movies from NAS...")
- Added `SkeletonCard` component for skeleton placeholder cards
- `CollapsibleSection` now accepts `loading` and `loadingText` props
- While loading with no items: shows 4 skeleton cards + loading text
- While loading with partial items: shows real items + 2 trailing skeleton cards
- Category-specific views show type-appropriate loading messages

## No Changes
- `/home/z/my-project/src/app/api/jellyfin/catalog/route.ts` - Already supports `?type=MOVIE`, `?type=TV_SHOW`, `?type=MUSIC`

## Verification
- ESLint passes for all changed files
- Dev server shows no compilation errors
- Pre-existing Jellyfin image timeout error is unrelated
