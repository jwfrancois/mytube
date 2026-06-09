import { NextRequest, NextResponse } from 'next/server'
import { getJellyfinCredentials } from '@/lib/jellyfin-credentials'

const REQUEST_TIMEOUT = 10000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params
  const server = await getJellyfinCredentials()
  if (!server) {
    return NextResponse.json({ error: 'Jellyfin not connected' }, { status: 503 })
  }

  try {
    // First, try to fetch the item directly by ID - it could be a MusicArtist or MusicAlbum
    const itemUrl = `${server.serverUrl}/Users/${server.userId}/Items/${artistId}?Fields=Overview,Genres,ProductionLocations,PremiereDate,EndDate,CommunityRating,SortName`
    const itemController = new AbortController()
    const itemTimeoutId = setTimeout(() => itemController.abort(), REQUEST_TIMEOUT)
    const itemRes = await fetch(itemUrl, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: itemController.signal,
    })
    clearTimeout(itemTimeoutId)

    if (!itemRes.ok) {
      return NextResponse.json({ error: `Item not found: ${itemRes.status}` }, { status: itemRes.status })
    }
    const itemData = await itemRes.json()

    // Determine the actual artist ID
    let actualArtistId = artistId
    let artistName = itemData.Name || ''

    // If this is a MusicAlbum or Audio, we need to find the artist
    if (itemData.Type === 'MusicAlbum' || itemData.Type === 'Audio') {
      // Try to get the artist from AlbumArtist or ArtistItems
      if (itemData.AlbumArtists && Array.isArray(itemData.AlbumArtists) && itemData.AlbumArtists.length > 0) {
        actualArtistId = itemData.AlbumArtists[0].Id
        artistName = itemData.AlbumArtists[0].Name
      } else if (itemData.ArtistItems && Array.isArray(itemData.ArtistItems) && itemData.ArtistItems.length > 0) {
        actualArtistId = itemData.ArtistItems[0].Id
        artistName = itemData.ArtistItems[0].Name
      } else if (itemData.AlbumArtist) {
        // Search for the artist by name
        const searchUrl = `${server.serverUrl}/Users/${server.userId}/Items?SearchTerm=${encodeURIComponent(itemData.AlbumArtist)}&IncludeItemTypes=MusicArtist&Recursive=true&Limit=1`
        const searchController = new AbortController()
        const searchTimeoutId = setTimeout(() => searchController.abort(), REQUEST_TIMEOUT)
        const searchRes = await fetch(searchUrl, {
          headers: { 'X-Emby-Token': server.accessToken },
          signal: searchController.signal,
        })
        clearTimeout(searchTimeoutId)
        if (searchRes.ok) {
          const searchData = await searchRes.json()
          if (searchData.Items && searchData.Items.length > 0) {
            actualArtistId = searchData.Items[0].Id
            artistName = searchData.Items[0].Name
          }
        }
      }
    }

    // Fetch the actual artist details
    const artistUrl = `${server.serverUrl}/Users/${server.userId}/Items/${actualArtistId}?Fields=Overview,Genres,ProductionLocations,PremiereDate,EndDate,CommunityRating,SortName`
    const artistController = new AbortController()
    const artistTimeoutId = setTimeout(() => artistController.abort(), REQUEST_TIMEOUT)
    const artistRes = await fetch(artistUrl, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: artistController.signal,
    })
    clearTimeout(artistTimeoutId)

    let artistData = itemData
    if (artistRes.ok) {
      artistData = await artistRes.json()
    }

    // Fetch discography (albums by this artist)
    const albumsUrl = `${server.serverUrl}/Users/${server.userId}/Items?ArtistIds=${actualArtistId}&IncludeItemTypes=MusicAlbum&Recursive=true&Fields=Overview,Genres,ProductionYear,CommunityRating,PremiereDate,PrimaryImageTag,AlbumArtist,ArtistItems&SortBy=ProductionYear&SortOrder=Ascending&Limit=100`
    const albumsController = new AbortController()
    const albumsTimeoutId = setTimeout(() => albumsController.abort(), REQUEST_TIMEOUT)
    const albumsRes = await fetch(albumsUrl, {
      headers: { 'X-Emby-Token': server.accessToken },
      signal: albumsController.signal,
    })
    clearTimeout(albumsTimeoutId)

    const albumsData = albumsRes.ok ? await albumsRes.json() : { Items: [] }

    // Process artist info
    const artist = {
      id: artistData.Id,
      name: artistData.Name || artistName,
      overview: artistData.Overview || '',
      genres: artistData.Genres || [],
      birthDate: artistData.PremiereDate || '',
      birthYear: artistData.ProductionYear || null,
      endDate: artistData.EndDate || '',
      imageUrl: artistData.ImageTags?.Primary
        ? `/api/jellyfin/image/${artistData.Id}?type=Primary&tag=${artistData.ImageTags.Primary}`
        : artistData.PrimaryImageTag
          ? `/api/jellyfin/image/${artistData.Id}?type=Primary&tag=${artistData.PrimaryImageTag}`
          : '',
      communityRating: artistData.CommunityRating || null,
      productionLocations: artistData.ProductionLocations || [],
    }

    // Process discography
    const albums = (albumsData.Items || []).map((album: Record<string, unknown>) => ({
      id: album.Id as string,
      jellyfinId: album.Id as string,
      name: (album.Name as string) || '',
      year: (album.ProductionYear as number) || null,
      overview: (album.Overview as string) || '',
      genres: (album.Genres as string[]) || [],
      communityRating: (album.CommunityRating as number) || null,
      premiereDate: (album.PremiereDate as string) || '',
      imageUrl: (album as Record<string, unknown>).PrimaryImageTag
        ? `/api/jellyfin/image/${album.Id}?type=Primary&tag=${(album as Record<string, unknown>).PrimaryImageTag}`
        : (album.ImageTags as Record<string, string>)?.Primary
          ? `/api/jellyfin/image/${album.Id}?type=Primary&tag=${(album.ImageTags as Record<string, string>).Primary}`
          : '',
      albumArtist: (album as Record<string, unknown>).AlbumArtist as string || '',
    }))

    // Extract collaborations from album artist items
    const collaborations: { name: string; id: string }[] = []
    const seenCollabIds = new Set<string>([actualArtistId])
    for (const album of (albumsData.Items || [])) {
      const albumArtistItems = (album as Record<string, unknown>).ArtistItems
      if (Array.isArray(albumArtistItems)) {
        for (const ai of albumArtistItems) {
          const aiRecord = ai as Record<string, unknown>
          const aiId = aiRecord.Id as string
          if (!seenCollabIds.has(aiId)) {
            seenCollabIds.add(aiId)
            collaborations.push({ name: (aiRecord.Name as string) || '', id: aiId })
          }
        }
      }
    }

    // Build career timeline from albums
    const careerHighlights: { year: number; title: string; type: string }[] = []
    if (artist.birthYear) {
      careerHighlights.push({ year: artist.birthYear, title: `Born in ${artist.productionLocations?.[0] || ''}`.trim(), type: 'birth' })
    }
    for (const album of albums) {
      if (album.year) {
        careerHighlights.push({ year: album.year, title: album.name, type: 'album' })
      }
    }
    careerHighlights.sort((a, b) => a.year - b.year)

    return NextResponse.json({
      artist,
      albums,
      collaborations: collaborations.slice(0, 20),
      careerHighlights,
      totalAlbums: albumsData.TotalRecordCount || albums.length,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Failed to fetch artist data:', err)
    return NextResponse.json({ error: 'Failed to fetch artist data' }, { status: 500 })
  }
}
