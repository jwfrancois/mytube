# Task 4: Fix Podcast Library & TV Show Season Display

## Agent: podcast-tvfixer

## Summary
Fixed two major issues: (1) Podcast shows were being routed to the audio player instead of showing a browsable episode list, and (2) TV Show cards showed generic "X items" instead of season/episode counts.

## Changes Made

### VideoPlayer.tsx
- Moved `isBrowsableContainer` check BEFORE `isAudio` check in render logic
- Added `(currentMedia.type === 'PODCAST' && currentMedia.itemType !== 'Audio')` to browsable container condition
- Updated `isAudio` to `isAudioType(currentMedia.type) && !isBrowsableContainer` to exclude browsable containers
- Fixed duplicate `const isAudio` declaration
- Added early return for browsable containers in audio queue population useEffect
- Added PODCAST browsable check in playback start useEffect

### details/[itemId]/route.ts
- Added MusicAlbum type handling to fetch podcast episodes (Audio children)
- Returns `podcastEpisodes` array and `podcastTotalCount`
- Supports pagination via `episodeOffset` and `episodeLimit` query params

### MediaDetail.tsx
- Added `PodcastEpisodeInfo` interface
- Added `podcastEpisodes` and `podcastTotalCount` to `JellyfinDetailData`
- Added `PodcastEpisodeCard` component with thumbnail, play overlay, duration, premiere date
- Added `isPodcast` flag
- Added podcast episode list section with loading skeletons
- Added `handlePlayPodcastEpisode` callback

### MediaCard.tsx
- TV Show cards now show "X Seasons" instead of "X items"
- Podcast cards now show "X Episodes" instead of "X items"

### page.tsx
- `handlePlay` now opens browsable container view for folder items instead of doing nothing

### category/route.ts
- Optimized podcast query: `IncludeItemTypes=MusicAlbum` instead of `Series,MusicAlbum,LiveTvChannel,LiveTvProgram`
- Response time improved from ~10s to ~2s

## Jellyfin Server Structure
- Podcasts library: CollectionType='music', 60 podcast shows (MusicAlbum type)
- TV Shows library: CollectionType='tvshows', 291 series
- Podcast episodes are Audio type children of MusicAlbum items
