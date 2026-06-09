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

    // Call Jellyfin's PlaybackInfo API to get media sources and transcoding options
    // Use very high bitrate limits and aggressive DirectPlayProfiles to prefer direct play
    // This tells Jellyfin the client can handle anything, so it won't transcode unnecessarily
    const playbackUrl = `${server.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${server.userId}&StartTimeTicks=0&IsPlayback=true&AutoOpenLiveStream=true&MaxStreamingBitrate=2147483647`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(playbackUrl, {
      method: 'POST',
      headers: {
        'X-Emby-Token': server.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        DeviceProfile: {
          MaxStreamingBitrate: 2147483647,
          MaxStaticBitrate: 2147483647,
          MusicStreamingTranscodingBitrate: 320000,
          DirectPlayProfiles: [
            // Accept all common video containers with all common codecs
            { Container: 'mp4,m4v,mkv,webm,avi,mov,wmv,flv,ts,m2ts', AudioCodec: 'aac,mp3,ac3,eac3,opus,flac,vorbis,dts,truehd,aac-latm', VideoCodec: 'h264,h265,hevc,vp9,av1,mpeg2video,mpeg4,vc1', Type: 'Video' },
            // Accept all common audio formats
            { Container: 'mp3,aac,flac,wav,ogg,opus,m4a,wma,alac', Type: 'Audio' },
          ],
          TranscodingProfiles: [
            // Only transcode as absolute fallback - HLS for video
            {
              Container: 'ts',
              Type: 'Video',
              VideoCodec: 'h264',
              AudioCodec: 'aac',
              Protocol: 'hls',
              Context: 'Streaming',
              MinSegments: 1,
              BreakOnNonKeyFrames: true,
            },
            // MP3 transcode for audio as fallback
            {
              Container: 'mp3',
              Type: 'Audio',
              AudioCodec: 'mp3',
              Context: 'Streaming',
              Bitrate: 320000,
            },
          ],
          ContainerProfiles: [],
          CodecProfiles: [],
          SubtitleProfiles: [
            { Format: 'srt', Method: 'External' },
            { Format: 'srt', Method: 'Embed' },
            { Format: 'ass', Method: 'External' },
            { Format: 'ass', Method: 'Embed' },
          ],
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Jellyfin PlaybackInfo error:', res.status, errorText)
      return NextResponse.json({ error: 'Failed to get playback info' }, { status: res.status })
    }

    const data = await res.json()

    // Extract useful playback information
    const mediaSources = (data.MediaSources || []).map((source: any) => ({
      id: source.Id,
      name: source.Name,
      container: source.Container,
      size: source.Size,
      bitrate: source.Bitrate,
      directStreamUrl: source.DirectStreamUrl || null,
      transcodingUrl: source.TranscodingUrl || null,
      transcodingContainer: source.TranscodingContainer || null,
      transcodingProtocol: source.TranscodingProtocol || null,
      supportsDirectStream: source.SupportsDirectStream,
      supportsDirectPlay: source.SupportsDirectPlay,
      supportsTranscoding: source.SupportsTranscoding,
      videoType: source.VideoType,
      runTimeTicks: source.RunTimeTicks,
      mediaStreams: (source.MediaStreams || []).map((stream: any) => ({
        type: stream.Type,
        codec: stream.Codec,
        language: stream.Language,
        channels: stream.Channels,
        isDefault: stream.IsDefault,
        displayTitle: stream.DisplayTitle,
      })),
    }))

    // Determine the best playback method - prefer direct play to avoid unnecessary transcoding
    let bestMethod = 'direct'
    let streamUrl = ''
    const primarySource = mediaSources[0]

    if (primarySource) {
      // Priority: Direct Play > Direct Stream > HLS > Transcode
      // Direct play/direct stream uses no server resources
      if (primarySource.supportsDirectPlay || primarySource.supportsDirectStream) {
        bestMethod = 'direct'
        streamUrl = primarySource.directStreamUrl || ''
      } else if (primarySource.supportsTranscoding && primarySource.transcodingUrl) {
        if (primarySource.transcodingProtocol === 'hls') {
          bestMethod = 'hls'
          streamUrl = primarySource.transcodingUrl
        } else {
          bestMethod = 'transcode'
          streamUrl = primarySource.transcodingUrl
        }
      }
    }

    return NextResponse.json({
      itemId,
      mediaSources,
      bestMethod,
      streamUrl,
    })
  } catch (error) {
    console.error('Jellyfin playback info error:', error)
    return NextResponse.json({ error: 'Failed to get playback info' }, { status: 500 })
  }
}
