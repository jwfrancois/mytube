/**
 * Client-side HDHomerun utility
 * 
 * Fetches channel lineup and device info directly from the HDHomerun tuner
 * via the user's browser. This is necessary because the Next.js server may
 * be running in the cloud and unable to reach local network devices (like
 * an HDHomerun at 10.0.0.187), but the user's browser IS on the local
 * network and CAN reach the device.
 * 
 * HDHomerun HTTP API endpoints (served on port 80):
 *   /discover.json — Device info
 *   /lineup.json   — Channel lineup (JSON array)
 *   /lineup.html   — Channel lineup (HTML page)
 * 
 * HDHomerun streaming (port 5004):
 *   /auto/v{channel} — Raw MPEG-TS stream
 */

export interface HDHomerunDeviceInfo {
  DeviceID?: string
  DeviceId?: string
  ModelNumber?: string
  Model?: string
  FirmwareName?: string
  FirmwareVersion?: string
  TunerCount?: number
  ModelName?: string
  FriendlyName?: string
  Manufacturer?: string
  LineupURL?: string
}

export interface HDHomerunChannel {
  GuideNumber: string
  GuideName: string
  URL?: string
  ImageURL?: string
  LogoURL?: string
  HD?: boolean
}

export interface ParsedHDHomerunChannel {
  id: string
  name: string
  category: string
  streamUrl: string
  logoUrl?: string
  description: string
  source: 'hdhomerun'
  language: string
  country: string
  guideNumber: string
  hd: boolean
  tunerIp: string
}

/**
 * Get the configured HDHomerun IP address.
 * Priority: localStorage > NEXT_PUBLIC env var > empty string
 */
export function getHDHomerunIp(): string {
  if (typeof window === 'undefined') return ''
  // Check localStorage first (user may have configured it in Settings)
  try {
    const stored = localStorage.getItem('hdhr-tuner-ip')
    if (stored) return stored
  } catch {}
  // Fall back to env var
  return process.env.NEXT_PUBLIC_HDHOMERUN_IP || ''
}

/**
 * Set the HDHomerun IP address in localStorage
 */
export function setHDHomerunIp(ip: string): void {
  try {
    if (ip) {
      localStorage.setItem('hdhr-tuner-ip', ip)
    } else {
      localStorage.removeItem('hdhr-tuner-ip')
    }
  } catch {}
}

/**
 * Discover an HDHomerun device by fetching /discover.json directly from the browser.
 * Returns device info if reachable, null otherwise.
 */
export async function discoverHDHomerun(ip: string): Promise<HDHomerunDeviceInfo | null> {
  if (!ip) return null
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const res = await fetch(`http://${ip}/discover.json`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) return null
    
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Fetch the channel lineup from an HDHomerun tuner directly from the browser.
 * Uses /lineup.html endpoint as specified by the user.
 * Returns parsed channels in the LiveTVChannel format.
 */
export async function fetchHDHomerunLineup(ip: string): Promise<ParsedHDHomerunChannel[]> {
  if (!ip) return []
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    // Try /lineup.html first (user-specified endpoint)
    // NOTE: Do NOT set custom headers (like Accept) here — that triggers a
    // CORS preflight (OPTIONS) request which HDHomerun devices don't handle.
    // A "simple request" (GET with no custom headers) avoids the preflight
    // and works as long as the device sends Access-Control-Allow-Origin.
    let res = await fetch(`http://${ip}/lineup.html`, {
      signal: controller.signal,
    })
    
    // If /lineup.html doesn't return JSON, try /lineup.json
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) {
      clearTimeout(timeoutId)
      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000)
      
      res = await fetch(`http://${ip}/lineup.json`, {
        signal: controller2.signal,
      })
      
      clearTimeout(timeoutId2)
    } else {
      clearTimeout(timeoutId)
    }
    
    if (!res.ok) return []
    
    const lineup: HDHomerunChannel[] = await res.json()
    
    if (!Array.isArray(lineup)) return []
    
    // Parse and sort by channel number
    const channels = lineup.map(ch => parseHDHomerunChannel(ch, ip))
    channels.sort((a, b) => {
      const numA = parseFloat(a.guideNumber)
      const numB = parseFloat(b.guideNumber)
      return numA - numB
    })
    
    return channels
  } catch (err) {
    console.warn('[HDHomerun] Failed to fetch lineup from browser:', err)
    return []
  }
}

/**
 * Parse a raw HDHomerun channel object into our LiveTVChannel format.
 */
function parseHDHomerunChannel(ch: HDHomerunChannel, tunerIp: string): ParsedHDHomerunChannel {
  const guideNumber = ch.GuideNumber || '0'
  const guideName = ch.GuideName || `Channel ${guideNumber}`
  
  return {
    id: `hdhr-${guideNumber}`,
    name: guideName,
    category: mapHDHRCategory(guideName),
    streamUrl: `/api/livetv/stream/hdhr-${encodeURIComponent(guideNumber)}`,
    logoUrl: ch.ImageURL || ch.LogoURL || undefined,
    description: `${guideName} — Channel ${guideNumber}${ch.HD ? ' (HD)' : ''}`,
    source: 'hdhomerun',
    language: 'English',
    country: 'US',
    guideNumber,
    hd: !!ch.HD,
    tunerIp,
  }
}

/**
 * Map channel name to a LiveTV category based on keywords.
 */
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
