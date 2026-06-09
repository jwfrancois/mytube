import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Fetch HDHomerun channel lineup
async function fetchHDHomerunLineup() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('http://10.0.0.187/lineup.json', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`HDHomerun returned ${res.status}`)
    }

    return await res.json()
  } catch (error) {
    console.warn('HDHomerun lineup fetch error:', error)
    return null
  }
}

// Fetch live TV channels from Jellyfin
async function fetchJellyfinLiveTV(): Promise<any[]> {
  try {
    const server = await db.jellyfinServer.findFirst()
    if (!server?.connected) return []

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      `${server.serverUrl}/LiveTv/Channels?UserId=${server.userId}&Fields=PrimaryImageAspectRatio,Overview&api_key=${server.accessToken}`,
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    if (!res.ok) return []

    const data = await res.json()
    return (data.Items || []).map((ch: any) => ({
      id: `jf-livetv-${ch.Id}`,
      name: ch.Name || 'Unknown Channel',
      url: `${server.serverUrl}/Videos/${ch.Id}/stream?Static=true&api_key=${server.accessToken}`,
      thumbnail: ch.ImageTags?.Primary
        ? `/api/jellyfin/image/${ch.Id}?tag=${ch.ImageTags.Primary}`
        : '',
      genre: ch.ChannelType === 'TV' ? 'Television' : 'Radio',
      hdhrChannelNumber: ch.ChannelNumber || ch.Number || '',
    }))
  } catch (error) {
    console.warn('Jellyfin LiveTV fetch error:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  const allChannels: any[] = []
  const sources: string[] = []

  // 1. Try HDHomerun
  const hdhrLineup = await fetchHDHomerunLineup()
  if (hdhrLineup && Array.isArray(hdhrLineup) && hdhrLineup.length > 0) {
    const hdhrChannels = hdhrLineup.map((ch: any, index: number) => ({
      id: `hdhr-${ch.GuideNumber || index}`,
      name: ch.GuideName || `Channel ${ch.GuideNumber || index + 1}`,
      url: ch.URL || '',
      thumbnail: ch.Artwork || '',
      genre: ch.Affiliate || 'General',
      hdhrChannelNumber: ch.GuideNumber ? String(ch.GuideNumber) : String(index + 1),
    }))
    allChannels.push(...hdhrChannels)
    sources.push('hdhomerun')
  }

  // 2. Try Jellyfin Live TV channels
  const jellyfinChannels = await fetchJellyfinLiveTV()
  if (jellyfinChannels.length > 0) {
    allChannels.push(...jellyfinChannels)
    sources.push('jellyfin')
  }

  // 3. If no channels from either source, provide demo channels
  if (allChannels.length === 0) {
    allChannels.push(...getDemoChannels())
    sources.push('demo')
  }

  return NextResponse.json({
    channels: allChannels,
    source: sources.join('+'),
  })
}

function getDemoChannels() {
  return [
    {
      id: 'demo-1',
      name: 'Demo News 24/7',
      url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
      thumbnail: '',
      genre: 'News',
      hdhrChannelNumber: '2.1',
    },
    {
      id: 'demo-2',
      name: 'Demo Sports Network',
      url: 'https://media.w3.org/2010/05/bunny/movie.mp4',
      thumbnail: '',
      genre: 'Sports',
      hdhrChannelNumber: '4.1',
    },
    {
      id: 'demo-3',
      name: 'Demo Entertainment',
      url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
      thumbnail: '',
      genre: 'Entertainment',
      hdhrChannelNumber: '5.1',
    },
    {
      id: 'demo-4',
      name: 'Demo Kids Channel',
      url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
      thumbnail: '',
      genre: 'Kids',
      hdhrChannelNumber: '7.1',
    },
    {
      id: 'demo-5',
      name: 'Demo Music TV',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      thumbnail: '',
      genre: 'Music',
      hdhrChannelNumber: '9.1',
    },
    {
      id: 'demo-6',
      name: 'Demo Documentary',
      url: 'https://www.w3schools.com/html/movie.mp4',
      thumbnail: '',
      genre: 'Documentary',
      hdhrChannelNumber: '11.1',
    },
  ]
}
