import { db } from '@/lib/db'

const sampleMedia = [
  // Movies
  {
    title: 'Big Buck Bunny',
    description: 'A large and lovable rabbit deals with three tiny bullies in this animated comedy short film. Created by the Blender Foundation as an open movie project.',
    type: 'MOVIE',
    genre: 'Animation',
    thumbnail: '/thumbnails/big-buck-bunny.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: '9:56',
    releaseYear: 2008,
    artist: 'Peach Open Movie Project',
    channel: 'Blender Foundation',
    views: 2450000,
  },
  {
    title: 'Elephant Dream',
    description: 'The first Blender Open Movie. Two people explore a strange mechanical world, each perceiving it differently. A philosophical journey through surreal landscapes.',
    type: 'MOVIE',
    genre: 'Sci-Fi',
    thumbnail: '/thumbnails/elephant-dream.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: '10:53',
    releaseYear: 2006,
    artist: 'Blender Foundation',
    channel: 'Blender Foundation',
    views: 1890000,
  },
  {
    title: 'Sintel',
    description: 'A lonely young woman searches for her lost pet dragon, encountering dangerous creatures along the way. A stunning fantasy adventure from the Durian team.',
    type: 'MOVIE',
    genre: 'Fantasy',
    thumbnail: '/thumbnails/sintel.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: '14:48',
    releaseYear: 2010,
    artist: 'Durian Open Movie Project',
    channel: 'Blender Foundation',
    views: 3200000,
  },
  {
    title: 'Tears of Steel',
    description: 'In an apocalyptic future, a group fights to save humanity using robots and technology. A groundbreaking sci-fi film blending live action with CGI.',
    type: 'MOVIE',
    genre: 'Sci-Fi',
    thumbnail: '/thumbnails/tears-of-steel.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    duration: '12:14',
    releaseYear: 2012,
    artist: 'Mango Open Movie Project',
    channel: 'Blender Foundation',
    views: 1560000,
  },
  {
    title: 'The Ultimate Dog Show',
    description: 'Watch the most talented dogs compete in this spectacular showcase of canine abilities. From agility courses to obedience trials.',
    type: 'MOVIE',
    genre: 'Documentary',
    thumbnail: '/thumbnails/dog-show.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    duration: '0:30',
    releaseYear: 2023,
    artist: 'Nature Films',
    channel: 'Nature Channel',
    views: 890000,
  },
  {
    title: 'Subaru Forester Adventure',
    description: 'Follow the Subaru Forester through beautiful mountain landscapes and rugged terrain. An off-road adventure like no other.',
    type: 'MOVIE',
    genre: 'Adventure',
    thumbnail: '/thumbnails/subaru-forester.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruForesterOnStreetAndDirt.mp4',
    duration: '0:15',
    releaseYear: 2023,
    artist: 'Adventure Films',
    channel: 'Auto Adventures',
    views: 456000,
  },
  {
    title: 'Volkswagen GTI Review',
    description: 'A comprehensive review of the Volkswagen GTI featuring on-road and track performance testing.',
    type: 'MOVIE',
    genre: 'Documentary',
    thumbnail: '/thumbnails/vw-gti.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    duration: '0:12',
    releaseYear: 2023,
    artist: 'Auto Review',
    channel: 'Car Reviews',
    views: 234000,
  },
  // TV Shows
  {
    title: 'For Bigger Blazes',
    description: 'An exciting drama series about firefighters pushing their limits in the biggest blazes. Season 1 now streaming.',
    type: 'TV_SHOW',
    genre: 'Drama',
    thumbnail: '/thumbnails/bigger-blazes.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '0:15',
    releaseYear: 2023,
    artist: 'Fire Studios',
    channel: 'Drama Hub',
    views: 1230000,
  },
  {
    title: 'For Bigger Escapes',
    description: 'Thrilling escape adventures that take you to the most remote places on Earth. Can they make it out alive?',
    type: 'TV_SHOW',
    genre: 'Adventure',
    thumbnail: '/thumbnails/bigger-escapes.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: '0:15',
    releaseYear: 2023,
    artist: 'Escape Studios',
    channel: 'Adventure TV',
    views: 987000,
  },
  {
    title: 'For Bigger Fun',
    description: 'A fun-filled variety show featuring the best in comedy and entertainment. New episodes every week!',
    type: 'TV_SHOW',
    genre: 'Comedy',
    thumbnail: '/thumbnails/bigger-fun.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: '0:59',
    releaseYear: 2023,
    artist: 'Fun Studios',
    channel: 'Comedy Central',
    views: 2100000,
  },
  {
    title: 'For Bigger Joyrides',
    description: 'Experience the most thrilling joyrides across stunning landscapes worldwide. Buckle up!',
    type: 'TV_SHOW',
    genre: 'Adventure',
    thumbnail: '/thumbnails/bigger-joyrides.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    duration: '0:15',
    releaseYear: 2022,
    artist: 'Joy Studios',
    channel: 'Adventure TV',
    views: 678000,
  },
  {
    title: 'For Bigger Meltdowns',
    description: 'A gripping documentary series about the most dramatic meltdowns in history. From Chernobyl to Fukushima.',
    type: 'TV_SHOW',
    genre: 'Documentary',
    thumbnail: '/thumbnails/bigger-meltdowns.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    duration: '0:15',
    releaseYear: 2022,
    artist: 'Docu Studios',
    channel: 'History Channel',
    views: 543000,
  },
  // Music
  {
    title: 'Ambient Dreams',
    description: 'Relaxing ambient music perfect for studying, meditation, or unwinding after a long day. Let the sounds wash over you.',
    type: 'MUSIC',
    genre: 'Ambient',
    thumbnail: '/thumbnails/ambient-dreams.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: '3:45',
    releaseYear: 2024,
    artist: 'DreamScape',
    channel: 'Chill Vibes',
    views: 4560000,
  },
  {
    title: 'Electronic Pulse',
    description: 'High-energy electronic beats that will keep you moving all night long. Feel the bass drop!',
    type: 'MUSIC',
    genre: 'Electronic',
    thumbnail: '/thumbnails/electronic-pulse.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: '4:20',
    releaseYear: 2024,
    artist: 'DJ Volt',
    channel: 'Electric Beats',
    views: 3210000,
  },
  {
    title: 'Jazz Lounge Sessions',
    description: 'Smooth jazz sessions recorded live at the famous Blue Note Lounge. Sit back and relax.',
    type: 'MUSIC',
    genre: 'Jazz',
    thumbnail: '/thumbnails/jazz-lounge.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: '5:30',
    releaseYear: 2023,
    artist: 'Miles Davis Jr.',
    channel: 'Jazz FM',
    views: 1890000,
  },
  {
    title: 'Rock Legends Live',
    description: 'The greatest rock performances captured live on stage with incredible energy. Turn it up to 11!',
    type: 'MUSIC',
    genre: 'Rock',
    thumbnail: '/thumbnails/rock-legends.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    duration: '6:15',
    releaseYear: 2023,
    artist: 'The Thunder',
    channel: 'Rock Arena',
    views: 2780000,
  },
  {
    title: 'Classical Masterpieces',
    description: 'Timeless classical compositions performed by world-renowned orchestras. Pure musical perfection.',
    type: 'MUSIC',
    genre: 'Classical',
    thumbnail: '/thumbnails/classical.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: '7:00',
    releaseYear: 2023,
    artist: 'Vienna Philharmonic',
    channel: 'Classical Music',
    views: 1230000,
  },
  {
    title: 'Hip Hop Beats',
    description: 'Fresh hip hop beats with heavy bass and creative lyricism from top artists. Drop the beat!',
    type: 'MUSIC',
    genre: 'Hip Hop',
    thumbnail: '/thumbnails/hiphop.jpg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    duration: '3:55',
    releaseYear: 2024,
    artist: 'MC Flow',
    channel: 'Beat Station',
    views: 5430000,
  },
]

export async function GET() {
  try {
    // Clear existing data
    await db.playlistItem.deleteMany()
    await db.playlist.deleteMany()
    await db.media.deleteMany()

    // Create sample media
    for (const item of sampleMedia) {
      await db.media.create({ data: item })
    }

    // Create playlists
    const favPlaylist = await db.playlist.create({
      data: {
        name: 'My Favorites',
        description: 'My favorite videos and music',
      },
    })

    await db.playlist.create({
      data: {
        name: 'Watch Later',
        description: 'Videos to watch later',
      },
    })

    // Add some items to favorites
    const allMedia = await db.media.findMany({ take: 5 })
    for (let i = 0; i < allMedia.length; i++) {
      await db.playlistItem.create({
        data: {
          playlistId: favPlaylist.id,
          mediaId: allMedia[i].id,
          order: i,
        },
      })
    }

    return Response.json({ success: true, count: sampleMedia.length })
  } catch (error) {
    console.error('Seed error:', error)
    return Response.json({ error: 'Seed failed' }, { status: 500 })
  }
}
