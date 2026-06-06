# Task ID: 3 - metadata-enhancer

## Summary
Enhanced the MyTube streaming platform with rich metadata display for media items.

## Changes Made

### 1. `/api/jellyfin/details/[itemId]/route.ts`
- Extended Jellyfin API Fields parameter to include: CriticRating, ProviderIds, MediaStreams, Status, AirDays, ProductionLocations, ExternalUrls, RecursiveItemCount, TotalSeasonCount, CumulativeRunTimeTicks
- Split People into `people` (actors) and `crew` (directors, writers, producers, creators, showrunners)
- Added: `criticRating`, `runtime` (formatted), `cumulativeRuntime`, `status`, `airDays`, `airTime`, `providerIds`, `externalUrls`, `mediaInfo`, `totalSeasonCount`, `totalEpisodeCount`, `productionLocations`
- `mediaInfo` includes: container, fileSize, video (codec, width, height, resolution, HDR, frameRate, bitDepth), audio (codec, channels, channelLayout, language, sampleRate, bitRate), audioTrackCount, subtitleCount
- Helper functions: `formatRuntime()`, `formatFileSize()`

### 2. `/api/tmdb/search/route.ts`
- Added `external_ids` to `append_to_response` for IMDb ID, TVDB ID, Wikidata, social media
- Extracted `created_by` (show creators) from TMDB TV show data
- Extracted `networks` with logos from TMDB
- Extracted `production_countries` from TMDB
- Added `homepage` URL
- Extracted full crew with separated directors/writers/producers
- Added `runtime` (episode_run_time for TV, runtime for movies)
- Added `spokenLanguages`

### 3. `MediaDetail.tsx`
- New `CriticRatingBadge` component (green for fresh ≥60%, red for rotten)
- New Director section with `Clapperboard` icon and horizontal scrollable headshot cards
- New Writer section with `PenTool` icon and horizontal scrollable headshot cards
- New Technical Info panel with `Cpu` icon: resolution, codec, HDR badge, frame rate, bit depth, audio codec, channel layout, container, file size, audio/subtitle tracks
- New External Links section with styled link buttons (IMDb, TMDB, TVDB, Wikidata, social, official site)
- New Status badge (color-coded: Continuing=green, Ended=red, Released=sky, etc.)
- Runtime badge in quick info bar
- Season/Episode summary (e.g. "5 Seasons • 62 Episodes")
- Air days display for Series
- Creators/Showrunner section for TV shows
- Networks section with logo images
- Production info (studios, production companies with logos, country)
- Cumulative runtime badge for collections
- Episode cards enhanced with community rating
- `InfoRow` helper component for clean key-value display
- All new sections include loading skeletons

### 4. `VideoPlayer.tsx`
- Browsable container hero header: Added season/film count badges, duration display, flex-wrap for badges

## Lint Status
- Pre-existing lint errors in AudioPlayerBar.tsx (set-state-in-effect) and VideoPlayer.tsx (unused eslint-disable directives) — NOT introduced by this task
- Dev server compiles successfully with no new errors
