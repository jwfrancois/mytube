import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

function formatRuntime(ticks: number | null): string {
  if (!ticks) return ''
  const totalMinutes = Math.floor(ticks / 600000000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${bytes} B`
}

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
    const seasonId = searchParams.get('seasonId')

    // Fetch item details with extended fields
    const detailUrl = `${creds.serverUrl}/Items?Ids=${itemId}&UserId=${creds.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,Studios,RunTimeTicks,ProductionYear,CommunityRating,CriticRating,OfficialRating,MediaSources,ChildCount,People,ProviderIds,Status,AirDays,ProductionLocations,ExternalUrls,RecursiveItemCount,TotalSeasonCount,CumulativeRunTimeTicks`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const detailRes = await fetch(detailUrl, {
      headers: {
        'X-Emby-Token': creds.accessToken,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!detailRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch item details' }, { status: detailRes.status })
    }

    const detailData = await detailRes.json()
    const item = detailData.Items?.[0]

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Extract media streams info
    const mediaSource = item.MediaSources?.[0]
    const videoStream = mediaSource?.MediaStreams?.find((s: any) => s.Type === 'Video')
    const audioStreams = mediaSource?.MediaStreams?.filter((s: any) => s.Type === 'Audio') || []
    const primaryAudio = audioStreams[0]

    // Build external URLs from ProviderIds
    const providerIds = item.ProviderIds || {}
    const externalUrls: { name: string; url: string }[] = []

    if (providerIds.Imdb) {
      externalUrls.push({ name: 'IMDb', url: `https://www.imdb.com/title/${providerIds.Imdb}` })
    }
    if (providerIds.Tmdb) {
      const tmdbType = item.Type === 'Series' ? 'tv' : 'movie'
      externalUrls.push({ name: 'TMDB', url: `https://www.themoviedb.org/${tmdbType}/${providerIds.Tmdb}` })
    }
    if (providerIds.Tvdb) {
      externalUrls.push({ name: 'TheTVDB', url: `https://thetvdb.com/series/${providerIds.Tvdb}` })
    }
    // Also add any ExternalUrls from Jellyfin
    if (item.ExternalUrls) {
      for (const extUrl of item.ExternalUrls) {
        if (!externalUrls.some(e => e.name === extUrl.Name)) {
          externalUrls.push({ name: extUrl.Name, url: extUrl.Url })
        }
      }
    }

    // Build base response
    const result: any = {
      id: item.Id,
      name: item.Name || 'Untitled',
      overview: item.Overview || '',
      type: item.Type,
      genres: item.Genres || [],
      studios: (item.Studios || []).map((s: any) => s.Name),
      communityRating: item.CommunityRating || null,
      criticRating: item.CriticRating || null,
      officialRating: item.OfficialRating || '',
      productionYear: item.ProductionYear || null,
      runTimeTicks: item.RunTimeTicks || null,
      runtime: formatRuntime(item.RunTimeTicks),
      cumulativeRunTimeTicks: item.CumulativeRunTimeTicks || null,
      cumulativeRuntime: formatRuntime(item.CumulativeRunTimeTicks),
      childCount: item.ChildCount || 0,
      people: [],
      seasons: [],
      episodes: [],
      imageTags: item.ImageTags || {},

      // Status & Air info
      status: item.Status || '',           // "Continuing", "Ended" for Series; "Released" for Movies
      airDays: item.AirDays || [],         // ["Monday", "Wednesday"] for Series
      airTime: item.AirTime || '',          // "20:00" for Series

      // Production info
      productionLocations: item.ProductionLocations || [], // Country codes

      // Provider IDs & External URLs
      providerIds: {
        imdb: providerIds.Imdb || null,
        tmdb: providerIds.Tmdb || null,
        tvdb: providerIds.Tvdb || null,
      },
      externalUrls,

      // Media streams info
      mediaInfo: mediaSource ? {
        container: mediaSource.Container || '',
        fileSize: formatFileSize(mediaSource.Size),
        fileSizeBytes: mediaSource.Size || 0,
        video: videoStream ? {
          codec: videoStream.Codec || '',
          width: videoStream.Width || 0,
          height: videoStream.Height || 0,
          resolution: videoStream.Width >= 3840 ? '4K' :
                      videoStream.Width >= 2560 ? '1440p' :
                      videoStream.Width >= 1920 ? '1080p' :
                      videoStream.Width >= 1280 ? '720p' :
                      videoStream.Width >= 854 ? '480p' : 'SD',
          aspectRatio: videoStream.AspectRatio || '',
          frameRate: videoStream.RealFrameRate || 0,
          bitDepth: videoStream.BitDepth || 0,
          videoRange: videoStream.VideoRange || '', // "SDR", "HDR", "HDR10", "Dolby Vision"
        } : null,
        audio: primaryAudio ? {
          codec: primaryAudio.Codec || '',
          channels: primaryAudio.Channels || 0,
          channelLayout: primaryAudio.ChannelLayout || '',
          language: primaryAudio.Language || '',
          sampleRate: primaryAudio.SampleRate || 0,
          bitRate: primaryAudio.BitRate || 0,
        } : null,
        audioTrackCount: audioStreams.length,
        subtitleCount: mediaSource.MediaStreams?.filter((s: any) => s.Type === 'Subtitle').length || 0,
        bitRate: mediaSource.Bitrate || 0,
      } : null,

      // Counts for Series
      totalSeasonCount: item.TotalSeasonCount || item.RecursiveItemCount || 0,
      recursiveItemCount: item.RecursiveItemCount || 0,
    }

    // Extract cast/people - separate into actors and crew
    const people = item.People || []
    const actors: any[] = []
    const crew: any[] = []

    for (let i = 0; i < people.length; i++) {
      const p = people[i]
      const person: any = {
        id: p.Id || `person-${i}`,
        name: p.Name || '',
        role: p.Role || '',
        type: p.Type || '',
        primaryImageTag: p.PrimaryImageTag || '',
        thumbnail: p.Id && p.PrimaryImageTag
          ? `/api/jellyfin/image/${p.Id}?tag=${p.PrimaryImageTag}`
          : '',
      }

      if (p.Type === 'Actor') {
        actors.push(person)
      } else if (['Director', 'Writer', 'Producer', 'Creator', 'Showrunner'].includes(p.Type)) {
        crew.push(person)
      }
    }

    result.people = actors
    result.crew = crew

    // For Series type, fetch seasons
    if (item.Type === 'Series') {
      try {
        const seasonsUrl = `${creds.serverUrl}/Shows/${itemId}/Seasons?UserId=${creds.userId}&Fields=PrimaryImageAspectRatio,Overview,ChildCount`
        const seasonsController = new AbortController()
        const seasonsTimeout = setTimeout(() => seasonsController.abort(), 10000)

        const seasonsRes = await fetch(seasonsUrl, {
          headers: {
            'X-Emby-Token': creds.accessToken,
          },
          signal: seasonsController.signal,
        })

        clearTimeout(seasonsTimeout)

        if (seasonsRes.ok) {
          const seasonsData = await seasonsRes.json()
          result.seasons = (seasonsData.Items || []).map((s: any) => ({
            id: s.Id,
            name: s.Name || '',
            indexNumber: s.IndexNumber || 0,
            episodeCount: s.ChildCount || s.EpisodeCount || 0,
            overview: s.Overview || '',
            thumbnail: s.ImageTags?.Primary
              ? `/api/jellyfin/image/${s.Id}?tag=${s.ImageTags.Primary}`
              : '',
          }))

          // Update totalSeasonCount if not already set
          if (!result.totalSeasonCount && result.seasons.length > 0) {
            result.totalSeasonCount = result.seasons.length
          }

          // Calculate total episodes
          const totalEpisodes = result.seasons.reduce((sum: number, s: any) => sum + (s.episodeCount || 0), 0)

          // Fetch episodes for the first season by default (or the specified season)
          const targetSeasonId = seasonId || (result.seasons.length > 0 ? result.seasons[0].id : null)
          if (targetSeasonId) {
            const episodesUrl = `${creds.serverUrl}/Shows/${itemId}/Episodes?SeasonId=${targetSeasonId}&UserId=${creds.userId}&Fields=PrimaryImageAspectRatio,Overview,MediaSources,RunTimeTicks`
            const episodesController = new AbortController()
            const episodesTimeout = setTimeout(() => episodesController.abort(), 10000)

            const episodesRes = await fetch(episodesUrl, {
              headers: {
                'X-Emby-Token': creds.accessToken,
              },
              signal: episodesController.signal,
            })

            clearTimeout(episodesTimeout)

            if (episodesRes.ok) {
              const episodesData = await episodesRes.json()
              result.episodes = (episodesData.Items || []).map((e: any) => {
                const duration = formatRuntime(e.RunTimeTicks)

                return {
                  id: e.Id,
                  name: e.Name || '',
                  indexNumber: e.IndexNumber || 0,
                  parentIndexNumber: e.ParentIndexNumber || 1,
                  overview: e.Overview || '',
                  duration,
                  runTimeTicks: e.RunTimeTicks || null,
                  thumbnail: e.ImageTags?.Primary
                    ? `/api/jellyfin/image/${e.Id}?tag=${e.ImageTags.Primary}`
                    : '',
                  mediaSourceId: e.MediaSources?.[0]?.Id || e.Id,
                  hasVideo: e.MediaType === 'Video',
                  communityRating: e.CommunityRating || null,
                }
              })
            }
          }

          // Add totalEpisodeCount to result
          result.totalEpisodeCount = totalEpisodes
        }
      } catch (err) {
        console.error('Error fetching seasons/episodes:', err)
        // Non-fatal — continue with empty seasons/episodes
      }
    }

    // For MusicAlbum type, fetch children (audio tracks / podcast episodes)
    if (item.Type === 'MusicAlbum') {
      try {
        const episodeOffset = parseInt(searchParams.get('episodeOffset') || '0')
        const episodeLimit = Math.min(parseInt(searchParams.get('episodeLimit') || '50'), 200)
        const childrenUrl = `${creds.serverUrl}/Items?ParentId=${itemId}&UserId=${creds.userId}&IncludeItemTypes=Audio&Recursive=true&Fields=PrimaryImageAspectRatio,Overview,RunTimeTicks,ProductionYear,MediaSources,PremiereDate,IndexNumber,Artists,AlbumArtist&SortBy=SortName&SortOrder=Ascending&Limit=${episodeLimit}&StartIndex=${episodeOffset}`
        const childrenController = new AbortController()
        const childrenTimeout = setTimeout(() => childrenController.abort(), 10000)

        const childrenRes = await fetch(childrenUrl, {
          headers: {
            'X-Emby-Token': creds.accessToken,
          },
          signal: childrenController.signal,
        })

        clearTimeout(childrenTimeout)

        if (childrenRes.ok) {
          const childrenData = await childrenRes.json()
          result.podcastEpisodes = (childrenData.Items || []).map((ep: any) => {
            const duration = formatRuntime(ep.RunTimeTicks)

            return {
              id: ep.Id,
              name: ep.Name || '',
              overview: ep.Overview || '',
              duration,
              runTimeTicks: ep.RunTimeTicks || null,
              thumbnail: ep.ImageTags?.Primary
                ? `/api/jellyfin/image/${ep.Id}?tag=${ep.ImageTags.Primary}`
                : '',
              mediaSourceId: ep.MediaSources?.[0]?.Id || ep.Id,
              premiereDate: ep.PremiereDate || '',
              productionYear: ep.ProductionYear || null,
              communityRating: ep.CommunityRating || null,
              indexNumber: ep.IndexNumber || null,
              artists: ep.Artists || (ep.AlbumArtist ? [ep.AlbumArtist] : []),
            }
          })
          result.podcastTotalCount = childrenData.TotalRecordCount || 0
        }
      } catch (err) {
        console.error('Error fetching MusicAlbum children:', err)
        result.podcastEpisodes = []
        result.podcastTotalCount = 0
      }
    }

    // For BoxSet type, fetch children (movies in the collection)
    if (item.Type === 'BoxSet') {
      try {
        const childrenUrl = `${creds.serverUrl}/Items?ParentId=${itemId}&UserId=${creds.userId}&Fields=PrimaryImageAspectRatio,Overview,Genres,RunTimeTicks,ProductionYear,CommunityRating,MediaSources,ProviderIds&SortBy=SortName&SortOrder=Ascending`
        const childrenController = new AbortController()
        const childrenTimeout = setTimeout(() => childrenController.abort(), 10000)

        const childrenRes = await fetch(childrenUrl, {
          headers: {
            'X-Emby-Token': creds.accessToken,
          },
          signal: childrenController.signal,
        })

        clearTimeout(childrenTimeout)

        if (childrenRes.ok) {
          const childrenData = await childrenRes.json()
          result.children = (childrenData.Items || []).map((child: any) => ({
            ...child,
            runtime: formatRuntime(child.RunTimeTicks),
            childProviderIds: child.ProviderIds || {},
          }))
        }
      } catch (err) {
        console.error('Error fetching BoxSet children:', err)
        result.children = []
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Jellyfin details error:', error)
    return NextResponse.json({ error: 'Failed to fetch item details' }, { status: 500 })
  }
}
