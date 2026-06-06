# Task 3-a: Fix Empty Podcast Library & Add Popular/Watch Later/Recent Sections

## Summary

Completed both parts of the task successfully.

### Part 1: Fix Empty Podcast Library
- Added `PODCAST` and `AUDIOBOOK` to `MediaType` union type
- Fixed `libraries/route.ts` to map `CollectionType=podcasts` → `PODCAST` (was `MUSIC`) and `CollectionType=books` → `AUDIOBOOK` (was `MUSIC`)
- Fixed `items/route.ts` to include `AudioBook`, `LiveTvChannel`, `LiveTvProgram` in search IncludeItemTypes
- Added `collectionType` query parameter to items route for context-aware type mapping
- Updated Sidebar with Podcasts (Mic icon) and Audiobooks (Headphones icon) categories
- Updated JellyfinBrowser with PODCAST/AUDIOBOOK colors, icons, labels, and collectionType-based navigation

### Part 2: Add Popular/Watch Later/Recent Sections
- Created `useWatchHistory.ts` hook managing watch history and watch later in localStorage
- Updated MediaCard with Watch Later overlay button on hover and dropdown menu integration
- Created HorizontalShelf component in MediaGrid with YouTube-style horizontal scroll, arrow buttons, fade edges, and expand/collapse
- Updated page.tsx with "Continue Watching", "Popular", "Watch Later", and "By Genre" sections on the home page
- All sections use horizontal scrollable shelves with "See all" expand functionality

## Lint Status
Only pre-existing errors remain (VideoPlayer.tsx, start-server.js). All new/modified code passes lint.
