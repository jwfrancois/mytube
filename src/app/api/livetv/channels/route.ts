import { NextRequest, NextResponse } from 'next/server'
import { BUILT_IN_CHANNELS, getChannelsByCategory, searchChannels, LIVE_TV_CATEGORIES } from '@/lib/livetv-channels'
import { db } from '@/lib/db'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

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
        const creds = await getJellyfinCredentials()
        if (creds && creds.connected) {
          const jellyfinChannels = await fetchJellyfinLiveTVChannels(creds.serverUrl, creds.accessToken, creds.userId)
          channels = [...channels, ...jellyfinChannels]
        }
      } catch (err) {
        console.error('Failed to fetch Jellyfin Live TV channels:', err)
      }
    }

    // HDHomerun channels are fetched client-side only (the server may be in the cloud
    // and unable to reach local network devices). Return the tuner IP if known so the
    // client can fetch directly from the user's browser.
    let hdhrTunerIp: string | null = null
    if (includeHDHomerun) {
      try {
        const tuner = await db.hDHomerunTuner.findFirst({
          orderBy: { connected: 'desc' },
        })
        if (tuner) {
          hdhrTunerIp = tuner.tunerIp
        }
      } catch (err) {
        console.error('Failed to check HDHomerun tuner:', err)
      }

      // Fallback: use the HDHOMERUN_IP env var if no DB record exists.
      // This ensures the client always gets a tuner IP even if the tuner
      // was never registered through the Settings UI.
      if (!hdhrTunerIp) {
        hdhrTunerIp = process.env.HDHOMERUN_IP || null
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
      hdhrTunerIp, // Client uses this to fetch HDHomerun channels directly
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

// HDHomerun channels are fetched client-side only to avoid server-side timeouts
// when the server is in the cloud and can't reach local network devices.
