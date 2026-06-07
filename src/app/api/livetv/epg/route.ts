import { NextRequest, NextResponse } from 'next/server'
import { BUILT_IN_CHANNELS, LIVE_TV_CATEGORIES } from '@/lib/livetv-channels'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    // If a specific channel ID is requested, return its "now playing" info
    if (channelId) {
      const channel = BUILT_IN_CHANNELS.find(ch => ch.id === channelId)
      if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      }

      // Generate mock EPG data for the channel
      const now = new Date()
      const programs = generateMockEPG(channel, now)

      return NextResponse.json({
        channelId,
        channelName: channel.name,
        programs,
      })
    }

    // Try to fetch EPG from Jellyfin if connected
    let jellyfinEPG: any[] = []
    try {
      const server = await db.jellyfinServer.findFirst()
      if (server && server.connected) {
        const url = `${server.serverUrl}/LiveTv/Programs?UserId=${server.userId}&api_key=${server.accessToken}&Limit=100`
        const res = await fetch(url, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const data = await res.json()
          jellyfinEPG = data.Items || []
        }
      }
    } catch {
      // Jellyfin EPG not available
    }

    return NextResponse.json({
      categories: LIVE_TV_CATEGORIES,
      jellyfinPrograms: jellyfinEPG,
    })
  } catch (error) {
    console.error('EPG error:', error)
    return NextResponse.json({ error: 'Failed to fetch EPG' }, { status: 500 })
  }
}

/**
 * Generate mock EPG data for a channel.
 * In a real implementation, this would come from a proper EPG source.
 */
function generateMockEPG(channel: typeof BUILT_IN_CHANNELS[0], now: Date) {
  const programs = []
  const categories: Record<string, string[]> = {
    news: ['Breaking News', 'World Report', 'Market Update', 'Evening News', 'Morning Brief', 'NewsHour'],
    entertainment: ['Variety Show', 'Behind the Scenes', 'Celebrity Spotlight', 'Pop Culture', 'Entertainment Tonight'],
    movies: ['Feature Film', 'Classic Cinema', 'Director\'s Cut', 'Movie Marathon', 'Blockbuster'],
    sports: ['Live Game', 'SportsCenter', 'Highlight Reel', 'Pre-Game Show', 'Post-Game Analysis'],
    music: ['Music Videos', 'Live Concert', 'Acoustic Session', 'Top 20 Countdown', 'Artist Spotlight'],
    kids: ['Cartoon Time', 'Adventure Show', 'Educational Fun', 'Animated Series', 'Kids Club'],
    lifestyle: ['Home & Garden', 'Cooking Show', 'Travel Diaries', 'Wellness Hour', 'Design Studio'],
    science: ['Space Exploration', 'Tech Review', 'Science Daily', 'Innovation Lab', 'Discovery'],
    comedy: ['Stand-Up Hour', 'Comedy Central', 'Funny Moments', 'Improv Show', 'Comedy Special'],
    truecrime: ['Cold Case Files', 'Investigation', 'True Crime Story', 'Forensic Files', 'Mystery Hour'],
    gaming: ['Esports Live', 'Game Review', 'Speedrun Challenge', 'Let\'s Play', 'Gaming News'],
    international: ['World News', 'Cultural Show', 'Global Issues', 'International Report', 'World View'],
  }

  const channelPrograms = categories[channel.category] || categories.entertainment

  for (let i = -2; i < 6; i++) {
    const startTime = new Date(now.getTime() + i * 30 * 60 * 1000) // 30 min blocks
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000)
    const programName = channelPrograms[Math.abs(Math.floor(startTime.getTime() / (30 * 60 * 1000))) % channelPrograms.length]

    programs.push({
      id: `${channel.id}-${i}`,
      title: `${programName}`,
      description: `${programName} on ${channel.name}. ${channel.description}`,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      isLive: i === 0,
      isCurrent: startTime <= now && endTime > now,
    })
  }

  return programs
}
