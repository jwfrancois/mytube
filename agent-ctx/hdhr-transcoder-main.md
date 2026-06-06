# HDHomerun Transcoder Mini-Service

## Task ID
hdhr-transcoder

## Summary
Created a Bun-based transcoding mini-service that converts HDHomerun MPEG-TS streams to HLS format using FFmpeg, making live TV playable in browsers.

## Files Created

### `/home/z/my-project/mini-services/hdhr-transcoder/package.json`
- Standard Bun project config with `bun --hot index.ts` dev script

### `/home/z/my-project/mini-services/hdhr-transcoder/index.ts`
- Full transcoding service running on port 3010
- Manages FFmpeg processes per channel (MPEG-TS → HLS)
- Auto-cleanup of stale processes after 30s inactivity

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/status` | Active streams info |
| GET | `/stream/:channel/index.m3u8?tunerIp=<ip>` | Get HLS manifest (starts FFmpeg if needed) |
| GET | `/stream/:channel/seg_XXX.ts` | Serve HLS segment |
| POST | `/stop/:channel` | Kill FFmpeg for a channel |
| POST | `/stop-all` | Kill all FFmpeg processes |
| OPTIONS | `*` | CORS preflight |

## Architecture Details

- **Channel numbers**: Support both integer (e.g., `7`) and decimal (e.g., `7.1`) format
- **FFmpeg args**: `-c:v libx264 -preset veryfast -tune zerolatency -b:v 3000k` for low-latency transcoding
- **HLS config**: 4-second segments, 6-segment playlist, auto-delete old segments
- **Process management**: `Bun.spawn()` with `onExit` handler for cleanup
- **Stale detection**: 10-second interval check, kills processes idle >30 seconds
- **Temp directory**: `/tmp/hdhr-hls/<channel>/` for segments
- **CORS headers**: Set on all responses
- **Content types**: `application/vnd.apple.mpegurl` for m3u8, `video/mp2t` for .ts
- **Cache control**: `no-cache` for m3u8, `max-age=3600` for segments
- **Graceful shutdown**: SIGINT/SIGTERM handlers

## Integration Notes

The Next.js app can proxy m3u8 manifests through `/api/livetv/proxy-segment?url=...`, which rewrites segment URLs to also go through the proxy. The segment URLs in the manifest are relative (e.g., `seg_001.ts`), so the proxy resolves them against the mini-service base URL.

## Verified Tests

- ✅ Root endpoint returns service info
- ✅ Status endpoint returns active streams
- ✅ Missing `tunerIp` parameter returns 400 error
- ✅ Decimal channel numbers (e.g., 7.1) are supported
- ✅ Non-existent segments return 404
- ✅ Stop non-existent channel returns 404
- ✅ Stop-all works correctly
- ✅ CORS headers present on all responses
- ✅ Service runs on port 3010
