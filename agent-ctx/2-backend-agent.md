# Task 2 - Backend Agent Work Record

## Task: Backend Fixes for MyTube Jellyfin Streaming Platform

### Changes Made

1. **Auto-Connect to Jellyfin on Startup** (`src/app/page.tsx`)
   - Added `autoConnectAttemptedRef` to ensure only one connect attempt per session
   - On page load, checks Jellyfin status; if not connected, automatically calls `/api/jellyfin/connect` with known credentials
   - Silent operation — no dialog shown

2. **Fixed Video Streaming** (`src/app/api/jellyfin/stream/[itemId]/route.ts`)
   - All direct stream URLs now use `Static=true` to avoid transcoding
   - PlaybackInfo API request includes `StartTimeTicks=0`, `AutoOpenLiveStream=true`, and `DeviceId`
   - Transcoding profiles: HLS (ts) primary, MP4 fallback; both use AAC audio with `MaxAudioChannels=2`
   - `DeviceId=mytube-server-${server.id}` added to all requests
   - Extended DirectPlayProfiles with more audio/video codecs

3. **Fixed Podcast Library** (`src/app/api/jellyfin/category/route.ts`)
   - Name-pattern matching: any library with "podcast" in name is treated as podcast library regardless of CollectionType
   - Added `LiveTvChannel,LiveTvProgram` to PODCAST IncludeItemTypes
   - `mapJellyfinItem` handles MusicAlbum, LiveTvChannel, LiveTvProgram in podcast libraries

4. **Added Movie Collections (BoxSet) Support**
   - `src/app/api/jellyfin/category/route.ts`: Added COLLECTION mappings, root-level BoxSet fetch
   - `src/store/useAppStore.ts`: Added 'COLLECTION' to MediaType
   - `src/app/page.tsx`: Added Collections section on home page
   - `src/components/JellyfinBrowser.tsx`: Added BoxSet/Collection labels
   - `src/app/api/jellyfin/details/[itemId]/route.ts`: Added BoxSet children fetching
   - `src/components/MediaDetail.tsx`: Added Collection display with movie grid

5. **Fixed Media API** (`src/app/api/media/route.ts`)
   - Added 'COLLECTION' to types array for ALL/home view

6. **Updated Connect/Status Routes**
   - `src/app/api/jellyfin/connect/route.ts`: Added serverId constant to response
   - `src/app/api/jellyfin/status/route.ts`: Added serverId constant to response

7. **Fixed Search** (`src/app/api/search/route.ts`)
   - Added `LiveTvChannel,LiveTvProgram,BoxSet` to IncludeItemTypes
   - Fetches library list for parent collection type detection
   - Proper podcast type mapping based on parent library

### Verification
- `bun run lint` passes with no errors
- Dev server is running and serving requests successfully
- COLLECTION and PODCAST categories returning data
