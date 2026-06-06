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

    // DeviceId for session tracking
    const deviceId = `mytube-server-${server.id}`

    // Build the appropriate Jellyfin streaming URL based on media type
    let streamUrl: string
    if (mediaType === 'audio' || mediaType === 'music') {
      // Use universal audio endpoint for best browser compatibility
      streamUrl = `${server.serverUrl}/Audio/${itemId}/universal?UserId=${server.userId}&DeviceId=${deviceId}&api_key=${server.accessToken}&Container=mp3,aac,ogg,wav,flac,alac,m4a&TranscodingContainer=mp3&TranscodingProtocol=https&AudioCodec=mp3&MaxStreamingBitrate=320000&StartTimeTicks=0`
    } else if (directStream) {
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
                { Container: 'mp4,m4v,mkv,webm,avi,mov', AudioCodec: 'aac,mp3,opus,vorbis,flac,alac,ac3,eac3,dts', VideoCodec: 'h264,h265,hevc,vp8,vp9,av1', Type: 'Video' },
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
            if (mediaSource.SupportsDirectPlay || mediaSource.SupportsDirectStream) {
              // Direct play/stream is supported — use Static=true to avoid transcoding
              streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSource.Id || mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
            } else if (mediaSource.TranscodingUrl) {
              // Transcoding needed — use Jellyfin's recommended transcoding URL
              const transcodeUrl = mediaSource.TranscodingUrl
              streamUrl = transcodeUrl.startsWith('http')
                ? transcodeUrl
                : `${server.serverUrl}${transcodeUrl}`
            } else {
              // No stream info — fallback to static direct stream
              streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
            }
          } else {
            streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
          }
        } else {
          // Playback info failed — fallback to static direct stream
          streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
        }
      } catch (err) {
        // Playback info request failed — fallback to static direct stream
        console.error('Playback info error, using direct stream:', err)
        streamUrl = `${server.serverUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSourceId}&api_key=${server.accessToken}&DeviceId=${deviceId}`
      }
    } else {
      // Fallback transcoding: Use explicit codec parameters for browser-compatible playback
      // Always use AAC audio codec (browser compatible) with MaxAudioChannels=2
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
    const contentType = res.headers.get('content-type') || (mediaType === 'audio' || mediaType === 'music' ? 'audio/mpeg' : 'video/mp4')
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
