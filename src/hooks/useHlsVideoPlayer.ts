'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Hook to handle video playback with automatic HLS.js support.
 *
 * - If the source URL ends with `.m3u8`, it uses hls.js (unless the browser
 *   natively supports HLS, i.e. Safari).
 * - For all other URLs it sets the src directly on the <video> element.
 * - Includes automatic retry logic for network / fragment-load errors.
 * - Properly tears down the hls.js instance on unmount or source change.
 */

const MAX_NETWORK_RETRIES = 3
const RETRY_DELAY_MS = 2000

export interface HlsPlayerState {
  /** True while the stream is loading / buffering */
  loading: boolean
  /** Non-null when an unrecoverable error occurred */
  error: string | null
  /** Whether we are currently retrying after a network error */
  retrying: boolean
  /** Number of consecutive network-error retries so far */
  retryCount: number
}

export function useHlsVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  src: string | null
): HlsPlayerState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Keep a ref to the hls instance so cleanup can access it synchronously
  const hlsRef = useRef<any>(null)
  // Track whether we need to use HLS (vs native src)
  const useHlsRef = useRef(false)
  // Track retry count in a ref so the hls error handler always sees latest
  const retryCountRef = useRef(0)
  // Stable reference to src for the retry timer
  const srcRef = useRef(src)
  srcRef.current = src

  // ---------- helpers ----------

  const isHlsSource = useCallback((url: string) => {
    // .m3u8 URLs always need HLS
    if (url.toLowerCase().includes('.m3u8')) return true
    // Jellyfin direct stream URLs do NOT need HLS
    if (url.includes('/api/jellyfin/stream/')) return false
    // Jellyfin HLS proxy URLs
    if (url.includes('/api/jellyfin/hls/')) return true
    return false
  }, [])

  const canNativeHls = useCallback(() => {
    if (typeof document === 'undefined') return false
    const video = document.createElement('video')
    return video.canPlayType('application/vnd.apple.mpegurl') !== ''
  }, [])

  const resetState = useCallback(() => {
    setLoading(true)
    setError(null)
    setRetrying(false)
    setRetryCount(0)
    retryCountRef.current = 0
  }, [])

  // ---------- destroy hls instance ----------

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy()
      } catch {
        // ignore
      }
      hlsRef.current = null
    }
  }, [])

  // ---------- attempt playback ----------

  const playHlsStream = useCallback(
    async (video: HTMLVideoElement, url: string) => {
      // Clean up any previous hls instance
      destroyHls()

      // Safari can play HLS natively
      if (canNativeHls()) {
        video.src = url
        return
      }

      // Dynamically import hls.js (keeps initial bundle smaller)
      let Hls: any
      try {
        const mod = await import('hls.js')
        Hls = mod.default
      } catch (importErr) {
        console.error('[useHlsVideoPlayer] Failed to load hls.js:', importErr)
        setError('HLS playback library could not be loaded.')
        setLoading(false)
        return
      }

      if (!Hls.isSupported()) {
        setError('Your browser does not support HLS playback.')
        setLoading(false)
        return
      }

      const hls = new Hls({
        // Reasonable defaults for a media-center app
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferHole: 0.5,
        // Start at a reasonable quality
        startLevel: -1, // auto
        // ABR settings
        abrEwmaDefaultEstimate: 5000000, // 5 Mbps default estimate
        // Fragment loading
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingMaxRetryTimeout: 64000,
        fragLoadingRetryDelay: 1000,
        // Manifest loading
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        // Level loading
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        // Key loading
        keyLoadingTimeOut: 15000,
        keyLoadingMaxRetry: 4,
      })

      hlsRef.current = hls

      hls.loadSource(url)
      hls.attachMedia(video)

      // --- Event handlers ---

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay may be blocked by browser policy – that's fine,
          // the user can click play manually.
        })
      })

      hls.on(Hls.Events.ERROR, (_event: string, data: any) => {
        if (data.fatal) {
          console.error(
            '[useHlsVideoPlayer] HLS fatal error:',
            data.type,
            data.details
          )

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              // Track our own retry count for network errors.  hls.js may
              // have already retried internally, so we only retry the
              // *entire stream* a limited number of times.
              const currentRetries = retryCountRef.current
              if (currentRetries < MAX_NETWORK_RETRIES) {
                retryCountRef.current += 1
                setRetryCount(retryCountRef.current)
                setRetrying(true)

                console.warn(
                  `[useHlsVideoPlayer] Network error – retrying (${retryCountRef.current}/${MAX_NETWORK_RETRIES})…`
                )

                // Small delay before retrying the entire stream
                setTimeout(() => {
                  if (hlsRef.current) {
                    try {
                      hlsRef.current.startLoad()
                    } catch {
                      // If startLoad fails, try a full rebuild
                      const v = videoRef.current
                      if (v && srcRef.current) {
                        playHlsStream(v, srcRef.current)
                      }
                    }
                  }
                  setRetrying(false)
                }, RETRY_DELAY_MS)
              } else {
                // Exhausted retries
                setError(
                  'Network error while loading the video stream. The server may be unreachable or the media may be unavailable.'
                )
                setLoading(false)
                setRetrying(false)
                destroyHls()
              }
              break
            }

            case Hls.ErrorTypes.MEDIA_ERROR: {
              // Media errors can often be recovered by reloading the source
              console.warn(
                '[useHlsVideoPlayer] Media error – attempting recovery…'
              )
              try {
                hls.recoverMediaError()
              } catch {
                setError(
                  'The video format could not be decoded. The media may be corrupted or in an unsupported codec.'
                )
                setLoading(false)
                destroyHls()
              }
              break
            }

            default: {
              setError(
                `Playback error: ${data.details || 'Unknown error'}. The stream may be unavailable or in an unsupported format.`
              )
              setLoading(false)
              destroyHls()
            }
          }
        } else {
          // Non-fatal errors – just log
          console.warn(
            '[useHlsVideoPlayer] HLS non-fatal error:',
            data.type,
            data.details
          )
        }
      })
    },
    [destroyHls, canNativeHls]
  )

  // ---------- effect: set up player when src changes ----------

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      setLoading(false)
      return
    }

    resetState()

    const shouldUseHls = isHlsSource(src)
    useHlsRef.current = shouldUseHls

    if (shouldUseHls) {
      playHlsStream(video, src)
    } else {
      // Direct playback – just set the src
      video.src = src
      video.load()
    }

    // Cleanup on unmount or when src changes
    return () => {
      destroyHls()
      // Only clear src if the video element is still mounted
      if (video) {
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [src, playHlsStream, destroyHls, resetState, isHlsSource, videoRef])

  // ---------- effect: listen to native video events for non-HLS ----------

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onCanPlay = () => {
      setLoading(false)
      setError(null)
    }
    const onWaiting = () => setLoading(true)
    const onPlaying = () => {
      setLoading(false)
      setRetrying(false)
    }
    const onError = () => {
      if (useHlsRef.current) return // HLS errors handled by hls.js
      const err = video.error
      let msg = 'Failed to load the video.'
      if (err) {
        switch (err.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            msg = 'Playback was aborted.'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            msg = 'Network error occurred while loading the video. The server may be unreachable or the file may be too large.'
            break
          case MediaError.MEDIA_ERR_DECODE:
            msg = 'The video format could not be decoded.'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            msg = 'The video format is not supported by your browser.'
            break
        }
      }
      setError(msg)
      setLoading(false)
    }

    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('loadeddata', onCanPlay)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onError)

    return () => {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('loadeddata', onCanPlay)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('error', onError)
    }
  }, [videoRef])

  return { loading, error, retrying, retryCount }
}
