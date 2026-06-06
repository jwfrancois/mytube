---
Task ID: 1
Agent: Main Agent
Task: Populate NAS server media through website categories and libraries

Work Log:
- Created `/api/jellyfin/category/route.ts` - new API endpoint that fetches Jellyfin items by media type (MOVIE, TV_SHOW, MUSIC, PODCAST, AUDIOBOOK)
- Updated `/api/media/route.ts` to merge Jellyfin items with local items when `includeJellyfin=true` param is set; supports both specific categories and ALL (home) view
- Updated `page.tsx` to pass `includeJellyfin=true` when Jellyfin is connected; home page now shows sections like "Movies on NAS", "TV Shows on NAS", "Music on NAS", "Podcasts on NAS", "Audiobooks on NAS"
- Updated `MediaCard.tsx` to handle Jellyfin folder navigation (series/albums show chevron icon and navigate to detail view instead of trying to play)
- Updated `Sidebar.tsx` to dynamically fetch and display individual Jellyfin library names under the NAS Server section
- Updated `SearchResults` and `/api/search/route.ts` to also search Jellyfin content
- Fixed stream endpoint to use Jellyfin PlaybackInfo API for optimal direct play vs transcoding decision
- Fixed empty Podcast library - Podcasts library uses `collectionType: 'music'` so added name pattern matching to disambiguate Music vs Podcast libraries
- Added include/exclude name patterns for library disambiguation
- Fixed lint errors

Stage Summary:
- NAS media now populates through ALL category views: Home, Movies, TV Shows, Music, Podcasts, Audiobooks
- Home page shows organized sections: Popular, Movies on NAS, TV Shows on NAS, Music on NAS, Podcasts on NAS, Audiobooks on NAS, plus local genre sections
- Sidebar shows NAS Server section with individual library links (Movies, TV Shows, Music, Podcasts, Audiobooks, with Online badge)
- Podcast library fix: matches by library name "Podcasts" with collectionType "music"
- Search now includes Jellyfin items
- Stream endpoint uses PlaybackInfo API for better direct play support
