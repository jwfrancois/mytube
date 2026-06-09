/**
 * RadioBrowser API client
 * Free, open directory of 50,000+ internet radio stations
 * API docs: https://api.radio-browser.info/
 */

const RADIO_BROWSER_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
]

let activeServerIndex = 0

async function fetchWithFallback(path: string, options?: RequestInit): Promise<Response> {
  const errors: Error[] = []
  
  for (let i = 0; i < RADIO_BROWSER_SERVERS.length; i++) {
    const serverIndex = (activeServerIndex + i) % RADIO_BROWSER_SERVERS.length
    const url = `${RADIO_BROWSER_SERVERS[serverIndex]}${path}`
    
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MyTube/1.0',
          ...(options?.headers || {}),
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      })
      
      if (res.ok) {
        activeServerIndex = serverIndex // Remember working server
        return res
      }
      
      errors.push(new Error(`HTTP ${res.status} from ${RADIO_BROWSER_SERVERS[serverIndex]}`))
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }
  }
  
  throw new Error(`All RadioBrowser servers failed: ${errors.map(e => e.message).join('; ')}`)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadioBrowserStation {
  changeuuid: string
  stationuuid: string
  serveruuid: string
  name: string
  url: string
  url_resolved: string
  homepage: string
  favicon: string
  tags: string
  country: string
  countrycode: string
  state: string
  language: string
  languagecodes: string
  votes: number
  lastchangetime: string
  lastchangetime_iso8601: string
  codec: string
  bitrate: number
  hls: number
  lastcheckok: number
  lastchecktime: string
  lastchecktime_iso8601: string
  clicktimestamp: string
  clicktimestamp_iso8601: string
  clickcount: number
  clicktrend: number
  ssl_error: number
  geo_lat: number | null
  geo_long: number | null
  has_extended_info: boolean
}

export interface RadioBrowserCountry {
  name: string
  iso_3166_1: string
  stationcount: number
}

export interface RadioBrowserTag {
  name: string
  stationcount: number
}

export interface RadioBrowserLanguage {
  name: string
  iso_639: string
  stationcount: number
}

// ─── Transformed Station Type ─────────────────────────────────────────────────

export interface TransformedStation {
  stationId: string
  name: string
  streamUrl: string
  homepage: string
  favicon: string
  country: string
  countryCode: string
  genre: string
  tags: string
  bitrate: number
  codec: string
  votes: number
  language: string
  clickCount: number
  clickTrend: number
  lastCheckOk: boolean
  hls: boolean
}

function transformStation(s: RadioBrowserStation): TransformedStation {
  return {
    stationId: s.stationuuid,
    name: s.name,
    streamUrl: s.url_resolved || s.url,
    homepage: s.homepage,
    favicon: s.favicon,
    country: s.country,
    countryCode: s.countrycode,
    genre: s.tags?.split(',')[0]?.trim() || '',
    tags: s.tags,
    bitrate: s.bitrate,
    codec: s.codec,
    votes: s.votes,
    language: s.language,
    clickCount: s.clickcount,
    clickTrend: s.clicktrend,
    lastCheckOk: s.lastcheckok === 1,
    hls: s.hls === 1,
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Get top stations by clicks (most popular) */
export async function getTopStations(limit = 50, offset = 0): Promise<TransformedStation[]> {
  const res = await fetchWithFallback(`/json/stations/topclick/${limit}?offset=${offset}&hidebroken=true`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

/** Search stations by name */
export async function searchStations(query: string, limit = 50, offset = 0): Promise<TransformedStation[]> {
  const params = new URLSearchParams({
    name: query,
    limit: String(limit),
    offset: String(offset),
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
  })
  const res = await fetchWithFallback(`/json/stations/search?${params}`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

/** Get stations by country code */
export async function getStationsByCountry(countryCode: string, limit = 100, offset = 0): Promise<TransformedStation[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
  })
  const res = await fetchWithFallback(`/json/stations/bycountrycodeexact/${countryCode}?${params}`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

/** Get stations by tag/genre */
export async function getStationsByTag(tag: string, limit = 100, offset = 0): Promise<TransformedStation[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
  })
  const res = await fetchWithFallback(`/json/stations/bytag/${encodeURIComponent(tag)}?${params}`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

/** Get stations by language */
export async function getStationsByLanguage(language: string, limit = 100, offset = 0): Promise<TransformedStation[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
  })
  const res = await fetchWithFallback(`/json/stations/bylanguage/${encodeURIComponent(language)}?${params}`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

/** Get list of countries with station counts */
export async function getCountries(): Promise<RadioBrowserCountry[]> {
  const res = await fetchWithFallback('/json/countries?limit=300&order=stationcount&reverse=true')
  return res.json()
}

/** Get list of popular tags/genres */
export async function getTags(limit = 100): Promise<RadioBrowserTag[]> {
  const res = await fetchWithFallback(`/json/tags?limit=${limit}&order=stationcount&reverse=true`)
  return res.json()
}

/** Get list of languages */
export async function getLanguages(limit = 50): Promise<RadioBrowserLanguage[]> {
  const res = await fetchWithFallback(`/json/languages?limit=${limit}&order=stationcount&reverse=true`)
  return res.json()
}

/** Click a station (increment click count — helps ranking) */
export async function clickStation(stationUuid: string): Promise<void> {
  try {
    await fetchWithFallback(`/json/url/${stationUuid}`)
  } catch {
    // Non-critical — don't throw on click failure
  }
}

/** Advanced station search with multiple filters */
export async function advancedSearch(params: {
  name?: string
  country?: string
  countryCode?: string
  tag?: string
  tagList?: string[]
  language?: string
  codec?: string
  bitrateMin?: number
  bitrateMax?: number
  order?: string
  limit?: number
  offset?: number
}): Promise<TransformedStation[]> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit || 50),
    offset: String(params.offset || 0),
    hidebroken: 'true',
    order: params.order || 'clickcount',
    reverse: 'true',
  })
  
  if (params.name) searchParams.set('name', params.name)
  if (params.country) searchParams.set('country', params.country)
  if (params.countryCode) searchParams.set('countrycode', params.countryCode)
  if (params.tag) searchParams.set('tag', params.tag)
  if (params.tagList) searchParams.set('tagList', params.tagList.join(','))
  if (params.language) searchParams.set('language', params.language)
  if (params.codec) searchParams.set('codec', params.codec)
  if (params.bitrateMin) searchParams.set('bitrateMin', String(params.bitrateMin))
  if (params.bitrateMax) searchParams.set('bitrateMax', String(params.bitrateMax))
  
  const res = await fetchWithFallback(`/json/stations/search?${searchParams}`)
  const data: RadioBrowserStation[] = await res.json()
  return data.map(transformStation)
}

// ─── Curated Genres ──────────────────────────────────────────────────────────

export const CURATED_GENRES = [
  { id: 'rock', name: 'Rock', icon: '🎸' },
  { id: 'pop', name: 'Pop', icon: '🎤' },
  { id: 'jazz', name: 'Jazz', icon: '🎷' },
  { id: 'classical', name: 'Classical', icon: '🎻' },
  { id: 'electronic', name: 'Electronic', icon: '🎧' },
  { id: 'hip hop', name: 'Hip Hop', icon: '🔥' },
  { id: 'r&b', name: 'R&B / Soul', icon: '💜' },
  { id: 'country', name: 'Country', icon: '🤠' },
  { id: 'blues', name: 'Blues', icon: '🎺' },
  { id: 'reggae', name: 'Reggae', icon: '🟢' },
  { id: 'latin', name: 'Latin', icon: '💃' },
  { id: 'metal', name: 'Metal', icon: '🤘' },
  { id: 'folk', name: 'Folk', icon: '🪕' },
  { id: 'ambient', name: 'Ambient', icon: '🌊' },
  { id: 'world', name: 'World', icon: '🌍' },
  { id: 'news', name: 'News / Talk', icon: '📰' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'christian', name: 'Christian', icon: '✝️' },
  { id: 'oldies', name: 'Oldies', icon: '📻' },
  { id: 'indie', name: 'Indie', icon: '🎪' },
]

// ─── Curated Countries (top station counts) ──────────────────────────────────

export const CURATED_COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
]
