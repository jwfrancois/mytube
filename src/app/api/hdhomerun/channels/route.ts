import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/hdhomerun/channels
 * Fetch the channel lineup from a connected HDHomerun tuner.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tunerId = searchParams.get('tunerId')

    // Find the tuner
    const where = tunerId ? { id: tunerId } : { connected: true }
    const tuner = await db.hDHomerunTuner.findFirst({ where })

    if (!tuner) {
      return NextResponse.json(
        { error: 'No connected HDHomerun tuner found. Please add one in Settings.' },
        { status: 404 }
      )
    }

    if (!tuner.connected) {
      return NextResponse.json(
        { error: 'HDHomerun tuner is not connected' },
        { status: 400 }
      )
    }

    // Fetch the channel lineup
    try {
      const lineupUrl = `http://${tuner.tunerIp}/lineup.json`
      const res = await fetch(lineupUrl, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'MyTube/1.0' },
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch channel lineup: ${res.status}` },
          { status: 502 }
        )
      }

      const lineup = await res.json()

      // Map the lineup to our LiveTVChannel format
      const channels = lineup.map((ch: any) => ({
        id: `hdhr-${ch.GuideNumber}`,
        name: ch.GuideName || `Channel ${ch.GuideNumber}`,
        category: mapCategory(ch.GuideName || ''),
        streamUrl: `/api/livetv/stream/hdhr-${encodeURIComponent(ch.GuideNumber)}`,
        logoUrl: ch.ImageURL || ch.LogoURL || undefined,
        description: `${ch.GuideName || 'Channel ' + ch.GuideNumber} — Channel ${ch.GuideNumber}${ch.HD ? ' (HD)' : ''}`,
        source: 'hdhomerun',
        language: 'English',
        country: 'US',
        guideNumber: ch.GuideNumber,
        hd: !!ch.HD,
        tunerIp: tuner.tunerIp,
        tunerId: tuner.id,
      }))

      // Sort by channel number
      channels.sort((a: any, b: any) => {
        const numA = parseFloat(a.guideNumber)
        const numB = parseFloat(b.guideNumber)
        return numA - numB
      })

      return NextResponse.json({
        channels,
        tuner: {
          id: tuner.id,
          name: tuner.name,
          tunerIp: tuner.tunerIp,
          model: tuner.model,
        },
        total: channels.length,
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Could not reach HDHomerun tuner at ${tuner.tunerIp}. The device may be offline.` },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('HDHomerun channels error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

/**
 * Map channel name to a LiveTV category based on keywords.
 */
function mapCategory(name: string): string {
  const n = name.toLowerCase()

  // News
  if (/news|cnn|msnbc|bbc|nbc news|abc news|cbsn|eyewitness/.test(n)) return 'news'

  // Sports
  if (/sports|espn|fs1|nfl|nba|mlb|nhl|golf|tennis|olymp|rac|motor|fox sports|stadium/.test(n)) return 'sports'

  // Kids
  if (/kids|kid|child|cartoon|nick|disney|pbs kids|baby|junior|teen|sprout/.test(n)) return 'kids'

  // Movies
  if (/movie|film|cinema|flick|reel|halmark|hbo|showtime|starz/.test(n)) return 'movies'

  // Music
  if (/music|mtv|vh1|cmt|bet|concert|piano|jazz|classical|stingray|vevo/.test(n)) return 'music'

  // Lifestyle
  if (/food|cook|home|garden|travel|diy|craft|hgtv|tlc|bravo|style|fashion|wedding/.test(n)) return 'lifestyle'

  // Comedy
  if (/comedy|funny|laugh|stand.?up|improv/.test(n)) return 'comedy'

  // Science/Tech
  if (/science|tech|nasa|discovery|space|physics|nat geo|animal|planet/.test(n)) return 'science'

  // True Crime
  if (/crime|investigation|detective|forensic|murder|mystery|justice|court|law/.test(n)) return 'truecrime'

  // Gaming
  if (/game|gaming|esport|twitch|playstation|xbox/.test(n)) return 'gaming'

  // International
  if (/univision|telemundo|azteca|gala|tv5|france|dw|al jazeera|nhk|cctv|arirang|rt/.test(n)) return 'international'

  // Entertainment (default for broadcast networks and general channels)
  if (/abc|nbc|cbs|fox|pbs|cw|ion|metv|antenna|charge|comet|bumble/.test(n)) return 'entertainment'

  return 'entertainment'
}
