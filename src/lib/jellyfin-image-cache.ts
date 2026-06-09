/**
 * In-memory LRU cache for Jellyfin proxied images.
 * Caches binary image data to avoid re-proxying from Jellyfin.
 * Uses a size limit to prevent memory issues.
 */

interface CachedImage {
  data: Buffer
  contentType: string
  fetchedAt: number
}

const MAX_CACHE_SIZE = 500 // Max images to cache
const IMAGE_TTL = 30 * 60 * 1000 // 30 minutes
const imageCache = new Map<string, CachedImage>()

function getCacheKey(itemId: string, tag?: string, maxWidth?: string, type?: string): string {
  return `${itemId}:${tag || ''}:${maxWidth || '480'}:${type || 'Primary'}`
}

export function getCachedImage(key: string): { data: Buffer; contentType: string } | null {
  const entry = imageCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > IMAGE_TTL) {
    imageCache.delete(key)
    return null
  }
  return { data: entry.data, contentType: entry.contentType }
}

export function setCachedImage(key: string, data: Buffer, contentType: string): void {
  // Evict oldest entries if cache is full
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(imageCache.entries())
    // Delete oldest 100 entries
    for (let i = 0; i < 100 && i < entries.length; i++) {
      imageCache.delete(entries[i][0])
    }
  }

  imageCache.set(key, {
    data,
    contentType,
    fetchedAt: Date.now(),
  })
}

export { getCacheKey }
