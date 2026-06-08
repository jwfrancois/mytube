import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const creds = await getJellyfinCredentials()

    if (!creds || !creds.connected) {
      return NextResponse.json({ error: 'Not connected to Jellyfin' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const mediaSourceId = searchParams.get('mediaSourceId') || itemId
    const mediaType = searchParams.get('mediaType') || 'video'
    const streamFormat = searchParams.get('streamFormat') || 'direct'

    const deviceId = `mytube-server`

    // ─── HLS Mode ───
    if (streamFormat === 'hls') {
      try {
        const playbackInfoUrl = `${creds.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${creds.userId}&MaxStreamingBitrate=20000000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
        const playbackRes = await fetch(playbackInfoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': creds.accessToken,
          },
          body: JSON.stringify({
            DeviceProfile: {
              MaxStreamingBitrate: 20000000,
              MaxStaticBitrate: 20000000,
              MusicStreamingTranscodingBitrate: 320000,
              DirectPlayProfiles: [
                { Container: 'mp4,m4v', VideoCodec: 'h264', AudioCodec: 'aac,mp3,ac3,eac3', Type: 'Video' },
                { Container: 'webm', VideoCodec: 'vp9,vp8,av1', AudioCodec: 'opus,vorbis', Type: 'Video' },
                { Container: 'mov', VideoCodec: 'h264', AudioCodec: 'aac,mp3', Type: 'Video' },
              ],
              TranscodingProfiles: [
                { Container: 'ts', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', BreakOnNonKeyFrames: true },
                { Container: 'mp4', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'http', MaxAudioChannels: '2' },
                { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'http' },
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
              : `${creds.serverUrl}${mediaSource.TranscodingUrl}`
            const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`
            return NextResponse.json({
              url: proxyUrl,
              format: 'hls',
              mediaSourceId: mediaSource.Id || mediaSourceId,
            })
          }

          if (mediaSource?.SupportsDirectPlay || mediaSource?.SupportsDirectStream) {
            const hlsParams = new URLSearchParams({
              MediaSourceId: mediaSource.Id || mediaSourceId,
              api_key: creds.accessToken,
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
            const hlsUrl = `${creds.serverUrl}/Videos/${itemId}/stream.${encodeURIComponent('m3u8')}?${hlsParams.toString()}`
            const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`
            return NextResponse.json({
              url: proxyUrl,
              format: 'hls',
              mediaSourceId: mediaSource.Id || mediaSourceId,
            })
          }
        } else {
          console.error('PlaybackInfo failed:', playbackRes.status)
        }
      } catch (err) {
        console.error('HLS playback info error:', err)
      }

      // Fallback: construct an HLS URL manually
      const hlsParams = new URLSearchParams({
        MediaSourceId: mediaSourceId,
        api_key: creds.accessToken,
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
      const hlsUrl = `${creds.serverUrl}/Videos/${itemId}/stream.${encodeURIComponent('m3u8')}?${hlsParams.toString()}`
      const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`

      return NextResponse.json({
        url: proxyUrl,
        format: 'hls',
        mediaSourceId,
      })
    }

    // ─── Audio Mode ───
    if (mediaType === 'audio' || mediaType === 'music') {
      const headers: Record<string, string> = {}
      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        headers['Range'] = rangeHeader
      }

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

      // Strategy 0: Try direct download endpoint
      try {
        const downloadUrl = `${creds.serverUrl}/Items/${itemId}/Download?api_key=${creds.accessToken}`
        const downloadController = new AbortController()
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000)

        const downloadRes = await fetch(downloadUrl, {
          headers: { ...headers, 'X-Emby-Token': creds.accessToken },
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
        UserId: creds.userId,
        DeviceId: deviceId,
        api_key: creds.accessToken,
        Container: 'mp3,aac,ogg,wav,flac,alac,m4a,wma,flac',
        TranscodingContainer: 'mp3',
        TranscodingProtocol: 'http',
        AudioCodec: 'mp3',
        MaxStreamingBitrate: '3200000',
        StartTimeTicks: '0',
      })

      const universalUrl = `${creds.serverUrl}/Audio/${itemId}/universal?${audioParams.toString()}`

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

        console.warn(`Jellyfin universal audio endpoint returned ${res.status} for item ${itemId}, trying PlaybackInfo fallback...`)
      } catch (err) {
        console.warn('Jellyfin universal audio endpoint error, trying PlaybackInfo fallback:', err)
      }

      // Strategy 2: Use PlaybackInfo API
      try {
        const playbackInfoUrl = `${creds.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${creds.userId}&MaxStreamingBitrate=3200000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
        const playbackController = new AbortController()
        const playbackTimeout = setTimeout(() => playbackController.abort(), 10000)

        const playbackRes = await fetch(playbackInfoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': creds.accessToken,
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
                { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'http' },
                { Container: 'aac', AudioCodec: 'aac', Type: 'Audio', Context: 'Streaming', Protocol: 'http' },
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
              audioStreamUrl = `${creds.serverUrl}/Audio/${itemId}/stream?Static=true&MediaSourceId=${mediaSource.Id || mediaSourceId}&api_key=${creds.accessToken}&DeviceId=${deviceId}`
            } else if (mediaSource.TranscodingUrl) {
              const transcodeUrl = mediaSource.TranscodingUrl
              audioStreamUrl = transcodeUrl.startsWith('http')
                ? transcodeUrl
                : `${creds.serverUrl}${transcodeUrl}`
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
        const directUrl = `${creds.serverUrl}/Audio/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${creds.accessToken}&DeviceId=${deviceId}`
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

    // ─── Video Mode ───
    const makeHlsResponse = (hlsUrl: string, msId?: string) => {
      const proxyUrl = `/api/jellyfin/hls-proxy?url=${encodeURIComponent(hlsUrl)}`
      return NextResponse.json({
        url: proxyUrl,
        format: 'hls',
        mediaSourceId: msId || mediaSourceId,
      })
    }

    const buildManualHlsUrl = () => {
      const hlsParams = new URLSearchParams({
        MediaSourceId: mediaSourceId,
        api_key: creds.accessToken,
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
      return `${creds.serverUrl}/Videos/${itemId}/stream.${encodeURIComponent('m3u8')}?${hlsParams.toString()}`
    }

    try {
      const playbackInfoUrl = `${creds.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${creds.userId}&MaxStreamingBitrate=20000000&StartTimeTicks=0&AutoOpenLiveStream=true&DeviceId=${deviceId}`
      const playbackController = new AbortController()
      const playbackTimeout = setTimeout(() => playbackController.abort(), 30000)

      const playbackRes = await fetch(playbackInfoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': creds.accessToken,
        },
        body: JSON.stringify({
          DeviceProfile: {
            MaxStreamingBitrate: 20000000,
            MaxStaticBitrate: 20000000,
            MusicStreamingTranscodingBitrate: 320000,
            DirectPlayProfiles: [
              { Container: 'mp4,m4v', VideoCodec: 'h264', AudioCodec: 'aac,mp3,ac3,eac3', Type: 'Video' },
              { Container: 'webm', VideoCodec: 'vp9,vp8,av1', AudioCodec: 'opus,vorbis', Type: 'Video' },
              { Container: 'mov', VideoCodec: 'h264', AudioCodec: 'aac,mp3', Type: 'Video' },
            ],
            TranscodingProfiles: [
              { Container: 'ts', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', BreakOnNonKeyFrames: true },
              { Container: 'mp4', AudioCodec: 'aac', VideoCodec: 'h264', Type: 'Video', Context: 'Streaming', Protocol: 'http', MaxAudioChannels: '2' },
              { Container: 'mp3', AudioCodec: 'mp3', Type: 'Audio', Context: 'Streaming', Protocol: 'http' },
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

        if (mediaSource?.TranscodingUrl) {
          const hlsUrl = mediaSource.TranscodingUrl.startsWith('http')
            ? mediaSource.TranscodingUrl
            : `${creds.serverUrl}${mediaSource.TranscodingUrl}`
          return makeHlsResponse(hlsUrl, mediaSource.Id || mediaSourceId)
        }

        if (mediaSource?.SupportsDirectPlay || mediaSource?.SupportsDirectStream) {
          return makeHlsResponse(buildManualHlsUrl(), mediaSource.Id || mediaSourceId)
        }
      }
    } catch (err) {
      console.error('Playback info error, using manual HLS URL:', err)
    }

    return makeHlsResponse(buildManualHlsUrl())
  } catch (error) {
    console.error('Jellyfin stream error:', error)
    return NextResponse.json({ error: 'Failed to stream' }, { status: 500 })
  }
}
