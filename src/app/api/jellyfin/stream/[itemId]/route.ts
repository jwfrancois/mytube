import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const server = await db.jellyfinServer.findFirst()

    if (!server || !server.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const mediaSourceId = searchParams.get('mediaSourceId') || itemId
    const mediaType = searchParams.get('mediaType') || 'video'
    const directStream = searchParams.get('directStream') !== 'false'
    const streamFormat = searchParams.get('streamFormat') || 'direct' // 'direct' | 'hls' | 'transcode'

    // DeviceId for session tracking
    const deviceId = `mytube-server-${server.id}`

    // ─── HLS Mode: Proxy the m3u8 playlist with rewritten URLs ───
    // We fetch the m3u8 from Jellyfin, rewrite all segment URLs to go through
    // our /api/jellyfin/hls-proxy endpoint, and return the rewritten playlist.
    // This avoids CORS issues when hls.js tries to fetch segments directly.
    if (streamFormat === 'hls') {
      try {
        const playbackInfoUrl = `${server.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${server.userId}&MaxStreamingBitrate=20000000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
        const playbackRes = await fetch(playbackInfoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': server.accessToken,
          },
          body: JSON.stringify({
            DeviceProfile: {
              MaxStreamingBitrate: 20000000,
              MaxStaticBitrate: 20000000,
              MusicStreamingTranscodingBitrate: 320000,
              DirectPlayProfiles: [],
              TranscodingProfiles: [
                { Container: 'ts', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', BreakOnNonKeyFrames: true },
                { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'https' },
              ],
              CodecProfiles: [],
              SubtitleProfiles: [
                { Format: 'vtt', Method: 'External' },
                { Format: 'srt', Method: 'External' },
              ],
            },
          }),
        })

        if (playbackRes.ok) {
          const playbackData = await playbackRes.json()
          const mediaSource = playbackData.MediaSources?.[0]

          if (mediaSource?.TranscodingUrl) {
            const hlsUrl = mediaSource.TranscodingUrl.startsWith('http')
              ? mediaSource.TranscodingUrl
              : `${server.serverUrl}${mediaSource.TranscodingUrl}`

            // Return JSON with the proxy URL instead of the raw Jellyfin URL
            // The client will load this URL as the m3u8 source for hls.js
            const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`
            return NextResponse.json({
              url: proxyUrl,
              format: 'hls',
              mediaSourceId: mediaSource.Id || mediaSourceId,
            })
          }
        }
      } catch (err) {
        console.error('HLS playback info error:', err)
      }

      // Fallback: construct an HLS URL manually and proxy it
      const hlsParams = new URLSearchParams({
        MediaSourceId: mediaSourceId,
        api_key: server.accessToken,
        DeviceId: deviceId,
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Container: 'ts',
        TranscodingMaxAudioChannels: '2',
        MaxAudioChannels: '2',
        SegmentContainer: 'ts',
        MinSegments: '1',
        BreakOnNonKeyFrames: 'true',
        StartTimeTicks: '0',
      })
      const hlsUrl = `${server.serverUrl}/Videos/${itemId}/stream.${encodeURIComponent('m3u8')}?${hlsParams.toString()}`
      const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`

      return NextResponse.json({
        url: proxyUrl,
        format: 'hls',
        mediaSourceId,
      })
    }

    // ─── Audio Mode ───
    if (mediaType === 'audio' || mediaType === 'music') {
      // Forward the Range header from the client for seeking support
      const headers: Record<string, string> = {}
      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        headers['Range'] = rangeHeader
      }

      // Helper to proxy an audio response
      const proxyAudioResponse = (res: Response) => {
        const contentType = res.headers.get('content-type') || 'audio/mpeg'
        const contentLength = res.headers.get('content-length')
        const contentRange = res.headers.get('content-range')
        const acceptRanges = res.headers.get('accept-ranges') || 'bytes'
        const statusCode = res.status === 206 ? 206 : 200

        const responseHeaders: Record<string, string> = {
          'Content-Type': contentType,
          'Accept-Ranges': acceptRanges,
          'Cache-Control': 'public, max-age=3600',
        }

        if (contentLength) responseHeaders['Content-Length'] = contentLength
        if (contentRange) responseHeaders['Content-Range'] = contentRange

        return new NextResponse(res.body, {
          status: statusCode,
          headers: responseHeaders,
        })
      }

      // Strategy 0: Try direct download endpoint (no transcoding)
      try {
        const downloadUrl = `${server.serverUrl}/Items/${itemId}/Download?api_key=${server.accessToken}`
        const downloadController = new AbortController()
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000)

        const downloadRes = await fetch(downloadUrl, {
          headers: { ...headers, 'X-Emby-Token': server.accessToken },
          signal: downloadController.signal,
        })

        clearTimeout(downloadTimeout)

        if (downloadRes.ok || downloadRes.status === 206) {
          return proxyAudioResponse(downloadRes)
        }

        console.warn(`Jellyfin download endpoint returned ${downloadRes.status} for item ${itemId}, trying universal endpoint...`)
      } catch (err) {
        console.warn('Jellyfin download endpoint error, trying universal endpoint:', err)
      }

      // Strategy 1: Try the universal audio endpoint
      const audioParams = new URLSearchParams({
        UserId: server.userId,
        DeviceId: deviceId,
        api_key: server.accessToken,
        Container: 'mp3,aac,ogg,wav,flac,alac,m4a,wma,flac',
        TranscodingContainer: 'mp3',
        TranscodingProtocol: 'https',
        AudioCodec: 'mp3',
        MaxStreamingBitrate: '3200000',
        StartTimeTicks: '0',
      })

      const universalUrl = `${server.serverUrl}/Audio/${itemId}/universal?${audioParams.toString()}`

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const res = await fetch(universalUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (res.ok || res.status === 206) {
          return proxyAudioResponse(res)
        }

        // Universal endpoint failed — log and try fallback
        console.warn(`Jellyfin universal audio endpoint returned ${res.status} for item ${itemId}, trying PlaybackInfo fallback...`)
      } catch (err) {
        console.warn('Jellyfin universal audio endpoint error, trying PlaybackInfo fallback:', err)
      }

      // Strategy 2: Use PlaybackInfo API to get a stream URL (like video mode does)
      try {
        const playbackInfoUrl = `${server.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${server.userId}&MaxStreamingBitrate=3200000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
        const playbackController = new AbortController()
        const playbackTimeout = setTimeout(() => playbackController.abort(), 10000)

        const playbackRes = await fetch(playbackInfoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': server.accessToken,
          },
          body: JSON.stringify({
            DeviceProfile: {
              MaxStreamingBitrate: 3200000,
              MaxStaticBitrate: 3200000,
              MusicStreamingTranscodingBitrate: 3200000,
              DirectPlayProfiles: [
                { Container: 'mp3,aac,ogg,wav,flac,alac,m4a,wma,flac', AudioCodec: 'mp3,aac,opus,vorbis,flac,alac', Type: 'Audio' },
              ],
              TranscodingProfiles: [
                { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'https' },
                { Container: 'aac', AudioCodec: 'aac', Type: 'Audio', Context: 'Streaming', Protocol: 'https' },
              ],
              CodecProfiles: [],
              SubtitleProfiles: [],
            },
          }),
          signal: playbackController.signal,
        })

        clearTimeout(playbackTimeout)

        if (playbackRes.ok) {
          const playbackData = await playbackRes.json()
          const mediaSource = playbackData.MediaSources?.[0]

          let audioStreamUrl: string | null = null

          if (mediaSource) {
            if (mediaSource.SupportsDirectPlay || mediaSource.SupportsDirectStream) {
              // Direct stream URL
              audioStreamUrl = `${server.serverUrl}/Audio/${itemId}/stream?Static=true&MediaSourceId=${mediaSource.Id || mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
            } else if (mediaSource.TranscodingUrl) {
              const transcodeUrl = mediaSource.TranscodingUrl
              audioStreamUrl = transcodeUrl.startsWith('http')
                ? transcodeUrl
                : `${server.serverUrl}${transcodeUrl}`
            }
          }

          if (audioStreamUrl) {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 120000)

            const streamRes = await fetch(audioStreamUrl, {
              headers,
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (streamRes.ok || streamRes.status === 206) {
              return proxyAudioResponse(streamRes)
            }

            console.error('Jellyfin PlaybackInfo audio stream error:', streamRes.status)
          }
        }
      } catch (err) {
        console.error('Jellyfin PlaybackInfo audio error:', err)
      }

      // Strategy 3: Last resort — direct stream URL
      try {
        const directUrl = `${server.serverUrl}/Audio/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120000)

        const res = await fetch(directUrl, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (res.ok || res.status === 206) {
          return proxyAudioResponse(res)
        }

        console.error('Jellyfin direct audio stream error:', res.status)
        return NextResponse.json({ error: 'Failed to stream audio from Jellyfin' }, { status: res.status })
      } catch (err) {
        console.error('Jellyfin direct audio stream error:', err)
        return NextResponse.json({ error: 'Failed to stream audio from Jellyfin' }, { status: 500 })
      }
    }

    // ─── Video Direct / Transcode Mode ───
    // Build the appropriate Jellyfin streaming URL based on mode
    let streamUrl: string

    if (directStream && streamFormat === 'direct') {
      // For video: Use the playback info API to get the best stream URL
      try {
        const playbackInfoUrl = `${server.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${server.userId}&MaxStreamingBitrate=20000000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
        const playbackController = new AbortController()
        const playbackTimeout = setTimeout(() => playbackController.abort(), 10000)

        const playbackRes = await fetch(playbackInfoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': server.accessToken,
          },
          body: JSON.stringify({
            DeviceProfile: {
              MaxStreamingBitrate: 20000000,
              MaxStaticBitrate: 20000000,
              MusicStreamingTranscodingBitrate: 320000,
              DirectPlayProfiles: [
                { Container: 'mp4,m4v,webm,mov', AudioCodec: 'aac,mp3,opus,vorbis,flac', VideoCodec: 'h264,vp8,vp9,av1', Type: 'Video' },
                { Container: 'mp3,aac,ogg,wav,flac,alac,m4a,wma', AudioCodec: 'mp3,aac,opus,vorbis,flac,alac', Type: 'Audio' },
              ],
              TranscodingProfiles: [
                { Container: 'ts', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', BreakOnNonKeyFrames: true },
                { Container: 'mp4', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'https', MaxAudioChannels: '2' },
                { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'https' },
              ],
              CodecProfiles: [],
              SubtitleProfiles: [
                { Format: 'vtt', Method: 'External' },
                { Format: 'srt', Method: 'External' },
                { Format: 'ass', Method: 'External' },
                { Format: 'subrip', Method: 'External' },
              ],
            },
          }),
          signal: playbackController.signal,
        })

        clearTimeout(playbackTimeout)

        if (playbackRes.ok) {
          const playbackData = await playbackRes.json()
          const mediaSource = playbackData.MediaSources?.[0]

          if (mediaSource) {
            // Check if the direct stream is browser-compatible
            const container = (mediaSource.Container || '').toLowerCase()
            const videoStream = (mediaSource.MediaStreams || []).find((s: Record<string, unknown>) => s.Type === 'Video')
            const audioStream = (mediaSource.MediaStreams || []).find((s: Record<string, unknown>) => s.Type === 'Audio')

            const browserSafeContainers = ['mp4', 'm4v', 'webm', 'mov']
            const browserSafeVideoCodecs = ['h264', 'h265', 'hevc', 'vp8', 'vp9', 'av1']
            const browserSafeAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac']

            const containerIsSafe = browserSafeContainers.includes(container)
            const videoIsSafe = !videoStream || browserSafeVideoCodecs.includes((videoStream.Codec || '').toLowerCase())
            const audioIsSafe = !audioStream || browserSafeAudioCodecs.includes((audioStream.Codec || '').toLowerCase())
            const isDirectPlaySafe = containerIsSafe && videoIsSafe && audioIsSafe

            if ((mediaSource.SupportsDirectPlay || mediaSource.SupportsDirectStream) && isDirectPlaySafe) {
              // Direct play/stream is supported AND codecs are browser-compatible
              streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSource.Id || mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
            } else if (mediaSource.SupportsDirectStream || mediaSource.SupportsDirectPlay) {
              // Container or audio codec not browser-safe — request progressive MP4 transcode with AAC audio
              // This creates a streamable MP4 that the browser can play directly (with audio!)
              const transcodeParams = new URLSearchParams({
                MediaSourceId: mediaSource.Id || mediaSourceId,
                api_key: server.accessToken,
                DeviceId: deviceId,
                VideoCodec: 'h264',
                AudioCodec: 'aac',
                Container: 'mp4',
                TranscodingMaxAudioChannels: '2',
                MaxAudioChannels: '2',
                SegmentContainer: 'mp4',
                MinSegments: '1',
                BreakOnNonKeyFrames: 'true',
                StartTimeTicks: '0',
              })
              streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?${transcodeParams.toString()}`
            } else if (mediaSource.TranscodingUrl) {
              // Use Jellyfin's transcoding URL as last resort (may be HLS)
              const transcodeUrl = mediaSource.TranscodingUrl.startsWith('http')
                ? mediaSource.TranscodingUrl
                : `${server.serverUrl}${mediaSource.TranscodingUrl}`
              // Try to proxy the transcode through our HLS proxy for CORS compatibility
              const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(transcodeUrl)}`
              return NextResponse.json({
                url: proxyUrl,
                format: 'hls',
                mediaSourceId: mediaSource.Id || mediaSourceId,
              })
            } else {
              streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
            }
          } else {
            streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
          }
        } else {
          streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
        }
      } catch (err) {
        console.error('Playback info error, using direct stream:', err)
        streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
      }
    } else {
      // Fallback transcoding: Use explicit codec parameters for browser-compatible playback
      const tparams = new URLSearchParams({
        MediaSourceId: mediaSourceId,
        api_key: server.accessToken,
        DeviceId: deviceId,
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        Container: 'mp4',
        TranscodingMaxAudioChannels: '2',
        MaxAudioChannels: '2',
        SegmentContainer: 'mp4',
        MinSegments: '1',
        BreakOnNonKeyFrames: 'true',
        StartTimeTicks: '0',
      })
      streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?${tparams.toString()}`
    }

    // Forward the Range header from the client for seeking support
    const headers: Record<string, string> = {}
    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }

    // Fetch from Jellyfin with extended timeout for streaming
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const res = await fetch(streamUrl, {
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 206) {
      console.error('Jellyfin stream error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ error: 'Failed to stream from Jellyfin' }, { status: res.status })
    }

    // Get the response headers
    const contentType = res.headers.get('content-type') || 'video/mp4'
    const contentLength = res.headers.get('content-length')
    const contentRange = res.headers.get('content-range')
    const acceptRanges = res.headers.get('accept-ranges') || 'bytes'
    const statusCode = res.status === 206 ? 206 : 200

    const body = res.body

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'public, max-age=3600',
    }

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    return new NextResponse(body, {
      status: statusCode,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Jellyfin stream error:', error)
    return NextResponse.json({ error: 'Failed to stream' }, { status: 500 })
  }
}
