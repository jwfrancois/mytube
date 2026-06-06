---
Task ID: 1
Agent: Main Agent
Task: Fix double audio playback (audiobook echo) and music tracks not loading

Work Log:
- Analyzed the root cause: both AudioPlayerBar and AudioPlayerView had their own `<audio>` elements, causing double playback
- Added `audioTrack`, `audioCurrentTime`, `audioDuration`, `audioElement`, `stopAudio` to the Zustand store for shared audio state
- Rewrote AudioPlayerBar to be the sole owner of the `<audio>` element, using `audioTrack` from the store
- Modified `setCurrentMedia` to also set `audioTrack` for audio types, and preserve `audioTrack` when `currentMedia` is cleared (for background playback)
- Rewrote AudioPlayerView to remove its own `<audio>` element and use shared state from the store
- Updated `playNext`/`playPrevious` to update `audioTrack` in addition to `currentMedia`
- Updated page.tsx to check `audioTrack` for bottom padding
- Fixed the Jellyfin audio stream 500 error by adding a 3-strategy fallback: universal endpoint → PlaybackInfo API → direct stream
- Fixed `mediaSourceId` extraction in the items API route
- Added `MediaSources` to the category API route fields
- Fixed hydration mismatch in MediaGrid.tsx by removing `animate-fade-in-up` and dynamic `animationDelay`
- Fixed duplicate key error by including `section.id` in the key pattern

Stage Summary:
- Double audio playback bug is FIXED - only 1 audio element exists now
- Audiobook plays correctly without echo
- Audio stream API has fallback when universal endpoint returns 500
- Background audio playback works when navigating back from audio view
- No hydration errors
- Verified with agent browser: audiobook plays correctly, duration shows ~25min, progress advances
