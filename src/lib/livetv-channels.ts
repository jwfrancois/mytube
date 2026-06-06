/**
 * Live TV Channel Database
 * 
 * Curated list of free, publicly available live TV channels.
 * These are legitimate free-to-air streams from services like Pluto TV,
 * government channels, and other free streaming providers.
 * 
 * Users can also add custom M3U8 playlists and channels.
 */

export interface LiveTVChannel {
  id: string
  name: string
  category: LiveTVCategory
  streamUrl: string
  logoUrl?: string
  description: string
  source: string // e.g., 'pluto', 'nasa', 'custom', 'jellyfin'
  isFavorite?: boolean
  language?: string
  country?: string
}

export type LiveTVCategory = 
  | 'news'
  | 'entertainment' 
  | 'movies'
  | 'sports'
  | 'music'
  | 'kids'
  | 'lifestyle'
  | 'science'
  | 'comedy'
  | 'truecrime'
  | 'gaming'
  | 'international'

export interface LiveTVCategoryInfo {
  id: LiveTVCategory
  name: string
  icon: string
  color: string
}

export const LIVE_TV_CATEGORIES: LiveTVCategoryInfo[] = [
  { id: 'news', name: 'News', icon: 'Newspaper', color: 'text-red-400' },
  { id: 'entertainment', name: 'Entertainment', icon: 'Tv', color: 'text-blue-400' },
  { id: 'movies', name: 'Movies', icon: 'Film', color: 'text-amber-400' },
  { id: 'sports', name: 'Sports', icon: 'Trophy', color: 'text-emerald-400' },
  { id: 'music', name: 'Music', icon: 'Music', color: 'text-purple-400' },
  { id: 'kids', name: 'Kids & Family', icon: 'Baby', color: 'text-pink-400' },
  { id: 'lifestyle', name: 'Lifestyle', icon: 'Heart', color: 'text-rose-400' },
  { id: 'science', name: 'Science & Tech', icon: 'Microscope', color: 'text-cyan-400' },
  { id: 'comedy', name: 'Comedy', icon: 'Laugh', color: 'text-yellow-400' },
  { id: 'truecrime', name: 'True Crime', icon: 'Search', color: 'text-slate-400' },
  { id: 'gaming', name: 'Gaming', icon: 'Gamepad2', color: 'text-violet-400' },
  { id: 'international', name: 'International', icon: 'Globe', color: 'text-teal-400' },
]

export interface ExternalService {
  id: string
  name: string
  description: string
  url: string
  logoUrl?: string
  color: string
  channelCount: string
}

export const EXTERNAL_SERVICES: ExternalService[] = [
  {
    id: 'xumo',
    name: 'Xumo Play',
    description: 'Free live & on-demand streaming with 300+ channels of movies, TV, news, sports, and more.',
    url: 'https://play.xumo.com',
    color: 'from-orange-500 to-red-500',
    channelCount: '300+',
  },
  {
    id: 'samsung',
    name: 'Samsung TV Plus',
    description: 'Free live TV with 250+ channels including news, entertainment, movies, and sports.',
    url: 'https://www.samsungtvplus.com',
    color: 'from-blue-500 to-indigo-500',
    channelCount: '250+',
  },
  {
    id: 'tubi',
    name: 'Tubi',
    description: 'Free streaming with 50,000+ titles including live news, sports, and entertainment channels.',
    url: 'https://tubitv.com',
    color: 'from-purple-500 to-pink-500',
    channelCount: '200+',
  },
  {
    id: 'plex',
    name: 'Plex Channels',
    description: 'Free live TV with 250+ channels of movies, shows, news, and music — no subscription needed.',
    url: 'https://plex.tv/watch-free-tv',
    color: 'from-amber-500 to-orange-500',
    channelCount: '250+',
  },
]

/**
 * Built-in free channel database.
 * These are publicly available, free-to-access M3U8 streams.
 * URLs are curated from well-known free streaming providers.
 */
export const BUILT_IN_CHANNELS: LiveTVChannel[] = [
  // ─── News ──────────────────────────────────────────────────
  {
    id: 'news-bloomberg',
    name: 'Bloomberg TV',
    category: 'news',
    streamUrl: 'https://liveproduseast.akamaized.net/btv/desktop/akamai/europe/live/primary.m3u8',
    description: 'Global business and financial news, market data, and analysis.',
    source: 'bloomberg',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-nasa-tv',
    name: 'NASA TV',
    category: 'science',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    description: 'NASA\'s official television channel featuring live coverage of missions and space events.',
    source: 'nasa',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-nasa-media',
    name: 'NASA Media Channel',
    category: 'science',
    streamUrl: 'https://ntv2.akamaized.net/hls/live/2013923/NASA-NTV2-HLS/master.m3u8',
    description: 'NASA media channel with press briefings, educational programming, and mission coverage.',
    source: 'nasa',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-abc-live',
    name: 'ABC News Live',
    category: 'news',
    streamUrl: 'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8',
    description: '24/7 live streaming news coverage from ABC News.',
    source: 'abc',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-reuters',
    name: 'Reuters Now',
    category: 'news',
    streamUrl: 'https://reuters-reutersnow-1-us.samsung.wurl.tv/manifest/playlist.m3u8',
    description: 'Breaking news and top stories from around the world by Reuters.',
    source: 'reuters',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-ewtn',
    name: 'EWTN News',
    category: 'news',
    streamUrl: 'https://cdn3.wowza.com/1/SmVrQmZCUXZhVDgz/b3JHVVFF/hls/live/playlist.m3u8',
    description: 'Catholic news and religious programming from EWTN.',
    source: 'ewtn',
    language: 'English',
    country: 'US',
  },
  {
    id: 'news-france24-en',
    name: 'France 24 English',
    category: 'international',
    streamUrl: 'https://stream.france24.com/F24_EN_HI_HLS/live_web.m3u8',
    description: 'International news channel providing a French perspective on world events.',
    source: 'france24',
    language: 'English',
    country: 'FR',
  },
  {
    id: 'news-dw-english',
    name: 'DW English',
    category: 'international',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    description: 'Deutsche Welle English — Germany\'s international broadcaster with global news and documentaries.',
    source: 'dw',
    language: 'English',
    country: 'DE',
  },
  {
    id: 'news-aljazeera',
    name: 'Al Jazeera English',
    category: 'international',
    streamUrl: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8',
    description: 'International news with a focus on the developing world from Al Jazeera.',
    source: 'aljazeera',
    language: 'English',
    country: 'QA',
  },
  {
    id: 'news-nhk-world',
    name: 'NHK World Japan',
    category: 'international',
    streamUrl: 'https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/domestic/263942/live_wa_s.m3u8',
    description: 'Japan\'s international broadcasting service with news and cultural programming.',
    source: 'nhk',
    language: 'English',
    country: 'JP',
  },

  // ─── Entertainment ──────────────────────────────────────────
  {
    id: 'ent-pluto-tv',
    name: 'Pluto TV Spotlight',
    category: 'entertainment',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5e825ed8e6a3b7000726a7a2/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0&deviceId=0&deviceType=web&deviceMake=0&deviceModel=web',
    description: 'Pluto TV Spotlight — featuring the best movies and shows streaming free.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'ent-pluto-court',
    name: 'Court TV',
    category: 'truecrime',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5dae0b4841a7d0000938ddff/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Live courtroom coverage and true crime programming.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'ent-pluto-nick',
    name: 'Nick Jr.',
    category: 'kids',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5ca670f6593a5d78f0e47832/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Nick Jr. — preschool shows and educational content for kids.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'ent-pluto-dora',
    name: 'Dora the Explorer',
    category: 'kids',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5d14fb6c84dd37e3b7f62586/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Dora the Explorer and friends — adventures for kids.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },

  // ─── Movies ──────────────────────────────────────────────────
  {
    id: 'movies-pluto-action',
    name: 'Pluto TV Action',
    category: 'movies',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5f1ac3204e4e6c0007b4e4de/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Non-stop action movies streaming free 24/7.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'movies-pluto-comedy',
    name: 'Pluto TV Comedy',
    category: 'comedy',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5cf3937ed4c2990009407296/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Comedy movies and stand-up specials streaming free.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'movies-pluto-horror',
    name: 'Pluto TV Horror',
    category: 'movies',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/56435e915b69c437037cc0fb/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Classic and modern horror movies streaming free.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'movies-pluto-romance',
    name: 'Pluto TV Romance',
    category: 'lifestyle',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5d46d711b8745c0007251e7e/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Romantic movies and love stories streaming free.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'movies-grjngo-western',
    name: 'Grjngo Western Movies',
    category: 'movies',
    streamUrl: 'https://grjngo.com/grjngo.m3u8',
    description: 'Classic and spaghetti western movies streaming free.',
    source: 'grjngo',
    language: 'English',
    country: 'US',
  },

  // ─── Sports ──────────────────────────────────────────────────
  {
    id: 'sports-stadium',
    name: 'Stadium Sports',
    category: 'sports',
    streamUrl: 'https://content.uplynk.com/channel/488404e3e6854db0bd9c6721ea0e8d83.m3u8',
    description: 'Live sports, highlights, and analysis across multiple sports.',
    source: 'stadium',
    language: 'English',
    country: 'US',
  },
  {
    id: 'sports-pluto-sports',
    name: 'Pluto TV Sports',
    category: 'sports',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/56435e915b69c437037cc0fc/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Free sports programming, highlights, and live events.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'sports-bein-sports',
    name: 'beIN Sports Xtra',
    category: 'sports',
    streamUrl: 'https://bfrench.akamaized.net/hls/live/2032779/bfmtv2/index.m3u8',
    description: 'Sports coverage and live events from beIN Sports.',
    source: 'bein',
    language: 'English',
    country: 'US',
  },

  // ─── Music ──────────────────────────────────────────────────
  {
    id: 'music-stingray-hits',
    name: 'Stingray Hits',
    category: 'music',
    streamUrl: 'https://stingray-hits.akamaized.net/hls/live/2092135/stingrayhits/index.m3u8',
    description: 'Today\'s biggest hits and chart-topping music videos.',
    source: 'stingray',
    language: 'English',
    country: 'US',
  },
  {
    id: 'music-stingray-classic',
    name: 'Stingray Classic Rock',
    category: 'music',
    streamUrl: 'https://stingray-classicrock.akamaized.net/hls/live/2092136/stingrayclassicrock/index.m3u8',
    description: 'Classic rock hits from the 60s, 70s, and 80s.',
    source: 'stingray',
    language: 'English',
    country: 'US',
  },
  {
    id: 'music-pluto-mtv',
    name: 'Pluto TV MTV Hits',
    category: 'music',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5d14fd1a252335000904a865/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Music videos and MTV classic programming.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'music-pluto-vevo',
    name: 'Vevo Pop Hits',
    category: 'music',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5d14fc2c84dd37e3b7f62583/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Pop music videos from Vevo streaming 24/7.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },

  // ─── Lifestyle ──────────────────────────────────────────────
  {
    id: 'lifestyle-pluto-food',
    name: 'Pluto TV Food',
    category: 'lifestyle',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5d2026e953475500096d1e80/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Cooking shows, food competitions, and culinary adventures.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
  {
    id: 'lifestyle-pluto-travel',
    name: 'Pluto TV Travel',
    category: 'lifestyle',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/59c01b27306c5b0008b4f7a5/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Travel shows and adventure programming from around the world.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },

  // ─── Comedy ──────────────────────────────────────────────────
  {
    id: 'comedy-pluto-standup',
    name: 'Pluto TV Stand-Up',
    category: 'comedy',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/563c8e8f257c2e0e6e0e8e0e/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Stand-up comedy specials from the funniest comedians.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },

  // ─── Gaming ──────────────────────────────────────────────────
  {
    id: 'gaming-pluto',
    name: 'Pluto TV Gaming',
    category: 'gaming',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5f1acd7c84dd37e3b7f62585/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'Gaming content, esports highlights, and gameplay videos.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },

  // ─── Science/Tech ──────────────────────────────────────────
  {
    id: 'science-twit',
    name: 'TWiT Live',
    category: 'science',
    streamUrl: 'https://twit.live/hls/twit.m3u8',
    description: 'This Week in Tech — live tech news and discussion.',
    source: 'twit',
    language: 'English',
    country: 'US',
  },

  // ─── True Crime ──────────────────────────────────────────────
  {
    id: 'crime-pluto',
    name: 'Pluto TV Crime',
    category: 'truecrime',
    streamUrl: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel/5e99e879b578260007e9e6ff/master.m3u8?deviceId=0&deviceType=web&deviceMake=0&deviceModel=web&sid=0',
    description: 'True crime documentaries and investigation shows.',
    source: 'pluto',
    language: 'English',
    country: 'US',
  },
]

/**
 * Get channels organized by category
 */
export function getChannelsByCategory(): Record<LiveTVCategory, LiveTVChannel[]> {
  const result: Record<string, LiveTVChannel[]> = {}
  for (const channel of BUILT_IN_CHANNELS) {
    if (!result[channel.category]) {
      result[channel.category] = []
    }
    result[channel.category].push(channel)
  }
  return result as Record<LiveTVCategory, LiveTVChannel[]>
}

/**
 * Find a channel by ID
 */
export function getChannelById(id: string): LiveTVChannel | undefined {
  return BUILT_IN_CHANNELS.find(ch => ch.id === id)
}

/**
 * Search channels by name or description
 */
export function searchChannels(query: string): LiveTVChannel[] {
  const q = query.toLowerCase()
  return BUILT_IN_CHANNELS.filter(ch =>
    ch.name.toLowerCase().includes(q) ||
    ch.description.toLowerCase().includes(q) ||
    ch.category.toLowerCase().includes(q)
  )
}
