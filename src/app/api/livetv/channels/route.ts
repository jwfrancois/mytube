import { NextRequest, NextResponse } from 'next/server'
import { BUILT_IN_CHANNELS, getChannelsByCategory, searchChannels, LIVE_TV_CATEGORIES } from '@/lib/livetv-channels'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const includeJellyfin = searchParams.get('includeJellyfin') === 'true'
    const includeHDHomerun = searchParams.get('includeHDHomerun') !== 'false' // default true

    let channels = [...BUILT_IN_CHANNELS]

    // Fetch Jellyfin Live TV channels if connected and requested
    if (includeJellyfin) {
      try {
        const server = await db.jellyfinServer.findFirst()
        if (server && server.connected) {
          const jellyfinChannels = await fetchJellyfinLiveTVChannels(server.serverUrl, server.accessToken, server.userId)
          channels = [...channels, ...jellyfinChannels]
        }
      } catch (err) {
        console.error('Failed to fetch Jellyfin Live TV channels:', err)
      }
    }

    // Fetch HDHomerun channels if a tuner is connected
    if (includeHDHomerun) {
      try {
        const tuner = await db.hDHomerunTuner.findFirst({ where: { connected: true } })
        if (tuner) {
          const hdhrChannels = await fetchHDHomerunChannels(tuner.tunerIp)
          channels = [...channels, ...hdhrChannels]
        }
      } catch (err) {
        console.error('Failed to fetch HDHomerun channels:', err)
      }
    }

    // Filter by category
    if (category) {
      channels = channels.filter(ch => ch.category === category)
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      channels = channels.filter(ch =>
        ch.name.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        ch.category.toLowerCase().includes(q)
      )
    }

    // Group by category
    const byCategory: Record<string, typeof channels> = {}
    for (const channel of channels) {
      if (!byCategory[channel.category]) {
        byCategory[channel.category] = []
      }
      byCategory[channel.category].push(channel)
    }

    return NextResponse.json({
      channels,
      categories: LIVE_TV_CATEGORIES,
      byCategory,
      total: channels.length,
    })
  } catch (error) {
    console.error('Live TV channels error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

/**
 * Fetch Live TV channels from Jellyfin server.
 * Jellyfin's Live TV requires a TV tuner (like HDHomeRun) to be configured.
 */
async function fetchJellyfinLiveTVChannels(
  serverUrl: string,
  accessToken: string,
  userId: string
): Promise<typeof BUILT_IN_CHANNELS> {
  try {
    const url = `${serverUrl}/LiveTv/Channels?UserId=${userId}&api_key=${accessToken}`
    const res = await fetch(url, {
      headers: { 'X-Emby-Token': accessToken },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return []

    const data = await res.json()
    const items = data.Items || []

    return items.map((item: any) => ({
      id: `jellyfin-livetv-${item.Id}`,
      name: item.Name || 'Unknown Channel',
      category: mapJellyfinChannelType(item.ChannelType, item.Name),
      streamUrl: `/api/livetv/stream/jellyfin-${item.Id}`,
      description: item.Name || 'Live TV channel from Jellyfin',
      source: 'jellyfin',
      language: 'English',
      country: 'US',
    }))
  } catch {
    return []
  }
}

function mapJellyfinChannelType(channelType: string, name: string): string {
  const nameLower = (name || '').toLowerCase()
  if (nameLower.includes('news')) return 'news'
  if (nameLower.includes('sport')) return 'sports'
  if (nameLower.includes('movie') || nameLower.includes('film')) return 'movies'
  if (nameLower.includes('music')) return 'music'
  if (nameLower.includes('kid') || nameLower.includes('cartoon')) return 'kids'
  return 'entertainment'
}

/**
 * Fetch channel lineup from an HDHomerun tuner.
 */
async function fetchHDHomerunChannels(tunerIp: string): Promise<typeof BUILT_IN_CHANNELS> {
  try {
    const lineupUrl = `http://${tunerIp}/lineup.json`
    const res = await fetch(lineupUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'MyTube/1.0' },
    })

    if (!res.ok) return []

    const lineup = await res.json()

    return lineup.map((ch: any) => ({
      id: `hdhr-${ch.GuideNumber}`,
      name: ch.GuideName || `Channel ${ch.GuideNumber}`,
      category: mapHDHRCategory(ch.GuideName || ''),
      streamUrl: `/api/livetv/stream/hdhr-${encodeURIComponent(ch.GuideNumber)}`,
      logoUrl: ch.ImageURL || ch.LogoURL || undefined,
      description: `${ch.GuideName || 'Channel ' + ch.GuideNumber} — Channel ${ch.GuideNumber}${ch.HD ? ' (HD)' : ''}`,
      source: 'hdhomerun',
      language: 'English',
      country: 'US',
    }))
  } catch {
    return []
  }
}

function mapHDHRCategory(name: string): string {
  const n = name.toLowerCase()
  if (/news|cnn|msnbc|bbc|nbc news|abc news|cbsn|eyewitness/.test(n)) return 'news'
  if (/sports|espn|fs1|nfl|nba|mlb|nhl|golf|tennis|olymp|rac|motor|fox sports|stadium/.test(n)) return 'sports'
  if (/kids|kid|child|cartoon|nick|disney|pbs kids|baby|junior|teen|sprout/.test(n)) return 'kids'
  if (/movie|film|cinema|flick|reel|halmark|hbo|showtime|starz/.test(n)) return 'movies'
  if (/music|mtv|vh1|cmt|bet|concert|piano|jazz|classical|stingray|vevo/.test(n)) return 'music'
  if (/food|cook|home|garden|travel|diy|craft|hgtv|tlc|bravo|style|fashion|wedding/.test(n)) return 'lifestyle'
  if (/comedy|funny|laugh|stand.?up|improv/.test(n)) return 'comedy'
  if (/science|tech|nasa|discovery|space|physics|nat geo|animal|planet/.test(n)) return 'science'
  if (/crime|investigation|detective|forensic|murder|mystery|justice|court|law/.test(n)) return 'truecrime'
  if (/game|gaming|esport|twitch|playstation|xbox/.test(n)) return 'gaming'
  if (/univision|telemundo|azteca|gala|tv5|france|dw|al jazeera|nhk|cctv|arirang|rt/.test(n)) return 'international'
  if (/abc|nbc|cbs|fox|pbs|cw|ion|metv|antenna|charge|comet|bumble/.test(n)) return 'entertainment'
  return 'entertainment'
}
