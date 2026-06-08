import { NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to help debug Jellyfin connection issues on Vercel.
 * Returns environment variable status and connectivity test results.
 */
export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      JELLYFIN_SERVER_URL: process.env.JELLYFIN_SERVER_URL ? '✅ Set' : '❌ Not set',
      JELLYFIN_USERNAME: process.env.JELLYFIN_USERNAME ? '✅ Set' : '❌ Not set',
      JELLYFIN_PASSWORD: process.env.JELLYFIN_PASSWORD ? '✅ Set' : '❌ Not set',
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Not set',
      NODE_ENV: process.env.NODE_ENV || 'unknown',
    },
  }

  // Test database connection
  try {
    const { db } = await import('@/lib/db')
    const serverCount = await db.jellyfinServer.count()
    const server = await db.jellyfinServer.findFirst()
    diagnostics.database = {
      status: '✅ Connected',
      jellyfinServerCount: serverCount,
      hasConnectedServer: !!(server?.connected && server?.accessToken),
      serverUrl: server?.serverUrl || null,
      serverUsername: server?.username || null,
    }
  } catch (dbError: any) {
    diagnostics.database = {
      status: '❌ Error',
      error: dbError?.message || String(dbError),
    }
  }

  // Test Jellyfin server reachability
  const serverUrl = process.env.JELLYFIN_SERVER_URL || 'https://manitou.dyabavadra.com'
  const baseUrl = serverUrl.replace(/\/+$/, '')

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const publicInfoRes = await fetch(`${baseUrl}/System/Info/Public`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (publicInfoRes.ok) {
      const info = await publicInfoRes.json()
      diagnostics.jellyfinServer = {
        status: '✅ Reachable',
        serverName: info.ServerName,
        version: info.Version,
        serverId: info.Id,
      }
    } else {
      diagnostics.jellyfinServer = {
        status: '⚠️ Responded with error',
        httpStatus: publicInfoRes.status,
      }
    }
  } catch (fetchError: any) {
    diagnostics.jellyfinServer = {
      status: '❌ Unreachable',
      error: fetchError?.name === 'AbortError' ? 'Timeout (10s)' : fetchError?.message || String(fetchError),
    }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
