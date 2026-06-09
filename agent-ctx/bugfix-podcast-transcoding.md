# Bug Fix Summary: Podcast Library Empty & Media Transcoding

## Bug 1: Podcast Library Empty

### Root Cause
1. `fetchItemsInLibrary` only called `fetchPodcastSeries` when the library **name** contained "podcast", but not when `CollectionType='podcasts'` or when `CollectionType='music'` with a PODCAST type request
2. The `isLibraryPossiblyOfType` function didn't exist, so libraries that could contain podcasts (e.g., `CollectionType='music'`) were skipped when filtering by `type=PODCAST`
3. The cache could store empty results from failed attempts, preventing retries
4. `mapJellyfinItem` mapped `Audio` items in podcast libraries as `MUSIC` instead of `PODCAST`

### Fixes Applied (`src/app/api/jellyfin/catalog/route.ts`)
1. **Cache fix**: Skip cache for specific type queries that returned 0 items, allowing fallback strategies to retry
2. **Added `isLibraryPossiblyOfType` function**: Broader matching that includes `CollectionType='music'` for PODCAST queries, `CollectionType='podcasts'` regardless of name
3. **Updated `fetchItemsInLibrary`**: Added `requestedType` parameter; calls `fetchPodcastSeries` when `CollectionType='podcasts'` OR when `type=PODCAST` is requested on a music library
4. **Fallback strategy**: When a specific type query returns 0 items, also tries `fetchItemsDirectly` as a second fallback
5. **Updated `mapJellyfinItem`**: Audio items in podcast libraries are now correctly mapped as PODCAST (not MUSIC); `podcasts` CollectionType check moved before `music` in priority
6. **Updated `fetchItemsDirectly`**: Also queries `Audio` items for PODCAST type (not just `Series`)
7. **Added `homevideos` case** to `mapLibraryType`

## Bug 2: Media Transcoding Too Much

### Root Cause
1. `startSmartPlayback` queried PlaybackInfo first and used it as a gate - if Jellyfin said transcoding was needed, the client would skip direct play entirely
2. The PlaybackInfo request's `DeviceProfile` had restrictive `DirectPlayProfiles` and included `TranscodingProfiles` with MP4 video transcode, signaling Jellyfin the client wanted transcoding
3. Low `MaxStreamingBitrate` (120Mbps) could trigger Jellyfin to transcode high-bitrate content

### Fixes Applied
1. **`src/components/VideoPlayer.tsx`**: Rewrote `startSmartPlayback` to ALWAYS try direct play first, regardless of PlaybackInfo. PlaybackInfo is queried in the background for informational purposes only, not as a gate. The existing error handler already falls back through HLS → transcode on failure.
2. **`src/app/api/jellyfin/playback/[itemId]/route.ts`**: 
   - Set `MaxStreamingBitrate` and `MaxStaticBitrate` to `2147483647` (max int) to prevent bitrate-based transcoding triggers
   - Expanded `DirectPlayProfiles` to accept all common containers and codecs (avi, mov, wmv, flv, ts, m2ts, ac3, dts, etc.)
   - Removed the MP4 transcode profile (only HLS transcode remains for video)
   - This tells Jellyfin "the client can handle anything, don't transcode"
3. **`src/app/api/jellyfin/stream/[itemId]/route.ts`**: Already uses `Static=true` for `mode=auto` (default) — no changes needed

## Verification
- All modified files pass ESLint with no errors
- Dev server is running and compiling successfully
