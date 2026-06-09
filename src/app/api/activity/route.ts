import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST - Log user activity (play, like)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jellyfinId, title, type, thumbnail, action } = body

    if (!jellyfinId || !action) {
      return NextResponse.json({ error: 'jellyfinId and action are required' }, { status: 400 })
    }

    try {
      await db.userActivity.upsert({
        where: { jellyfinId_action: { jellyfinId, action } },
        update: { title, type: type || 'MOVIE', thumbnail: thumbnail || '' },
        create: { jellyfinId, title, type: type || 'MOVIE', thumbnail: thumbnail || '', action },
      })
    } catch {
      // If upsert fails, try delete + create
      try {
        await db.userActivity.delete({ where: { jellyfinId_action: { jellyfinId, action } } })
      } catch { /* ignore */ }
      await db.userActivity.create({
        data: { jellyfinId, title, type: type || 'MOVIE', thumbnail: thumbnail || '', action },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Activity POST error:', error)
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
  }
}

// GET - Fetch user activity (history, likes)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = action ? { action } : {}
    const activities = await db.userActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      items: activities.map(a => ({
        id: `jf-${a.jellyfinId}`,
        title: a.title,
        type: a.type,
        thumbnail: a.thumbnail,
        isJellyfin: true,
        jellyfinId: a.jellyfinId,
        action: a.action,
        createdAt: a.createdAt,
      })),
    })
  } catch (error) {
    console.error('Activity GET error:', error)
    return NextResponse.json({ items: [] })
  }
}
