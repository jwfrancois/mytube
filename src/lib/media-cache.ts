import { db } from '@/lib/db'

/**
 * DB-Backed Media Cache
 *
 * Replaces in-memory Map caches that don't work on Vercel serverless.
 * Stores Jellyfin API responses in PostgreSQL with TTL-based expiration.
 *
 * Usage:
 *   const data = await mediaCache.get('category-MOVIE-100')
 *   await mediaCache.set('category-MOVIE-100', responseData, 120) // 120 seconds TTL
 */

const DEFAULT_TTL_SECONDS = 120 // 2 minutes default cache

export const mediaCache = {
  /**
   * Get cached data by key. Returns null if not found or expired.
   */
  async get<T = any>(cacheKey: string): Promise<T | null> {
    try {
      const entry = await db.mediaCache.findUnique({ where: { cacheKey } })
      if (!entry) return null

      // Check expiration
      if (new Date() > entry.expiresAt) {
        // Expired — delete it and return null
        await db.mediaCache.delete({ where: { cacheKey } }).catch(() => {})
        return null
      }

      return JSON.parse(entry.data) as T
    } catch (error) {
      console.error('Media cache get error:', error)
      return null
    }
  },

  /**
   * Set cached data with optional TTL in seconds.
   */
  async set(cacheKey: string, data: any, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
      const jsonData = JSON.stringify(data)

      await db.mediaCache.upsert({
        where: { cacheKey },
        create: { cacheKey, data: jsonData, expiresAt },
        update: { data: jsonData, expiresAt },
      })
    } catch (error) {
      console.error('Media cache set error:', error)
      // Non-fatal — caching failure shouldn't break the app
    }
  },

  /**
   * Delete a specific cache entry.
   */
  async delete(cacheKey: string): Promise<void> {
    try {
      await db.mediaCache.delete({ where: { cacheKey } }).catch(() => {})
    } catch {
      // Ignore
    }
  },

  /**
   * Delete all cache entries matching a prefix.
   * Useful for invalidating all category caches when reconnecting.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      await db.mediaCache.deleteMany({
        where: { cacheKey: { startsWith: prefix } },
      })
    } catch (error) {
      console.error('Media cache deleteByPrefix error:', error)
    }
  },

  /**
   * Clear all expired cache entries. Call periodically to keep the table clean.
   */
  async cleanExpired(): Promise<void> {
    try {
      await db.mediaCache.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    } catch (error) {
      console.error('Media cache cleanExpired error:', error)
    }
  },

  /**
   * Clear all cache entries.
   */
  async clear(): Promise<void> {
    try {
      await db.mediaCache.deleteMany()
    } catch (error) {
      console.error('Media cache clear error:', error)
    }
  },

  /**
   * Get or set cached data. If the key exists and is not expired, returns cached data.
   * Otherwise, calls the fetcher function, caches the result, and returns it.
   */
  async getOrSet<T = any>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
  ): Promise<T> {
    const cached = await mediaCache.get<T>(cacheKey)
    if (cached !== null) return cached

    const data = await fetcher()
    await mediaCache.set(cacheKey, data, ttlSeconds)
    return data
  },
}
