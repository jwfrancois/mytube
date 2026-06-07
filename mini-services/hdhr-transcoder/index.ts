/**
 * HDHomerun Live TV Transcoding Service
 *
 * Transcodes MPEG-TS streams from HDHomerun tuners into HLS segments
 * using FFmpeg, making them playable in browsers via hls.js.
 *
 * Runs on port 3010.
 *
 * Endpoints:
 *   GET /stream/:channelNumber/index.m3u8?tunerIp=<ip>&quality=<low|medium|high>
 *   GET /stream/:channelNumber/segment/:segment
 *   GET /status
 */

import { spawn, type ChildProcess } from "node:child_process";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = 3010;
const TEMP_DIR_PREFIX = "/tmp/hdhr-transcode-";
const FFMPEG_PATH = "/usr/bin/ffmpeg";
const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no access → kill process
const CLEANUP_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const M3U8_WAIT_TIMEOUT_MS = 10_000; // Wait up to 10s for m3u8 to appear
const M3U8_POLL_INTERVAL_MS = 250; // Poll every 250ms

// Quality presets: video bitrate
const QUALITY_BITRATES: Record<string, number> = {
  low: 1500,
  medium: 3000,
  high: 6000,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface StreamEntry {
  process: ChildProcess;
  tempDir: string;
  lastAccess: number;
  startedAt: number;
  tunerIp: string;
  channelNumber: string;
  quality: string;
  failed: boolean;
}

// ─── State ───────────────────────────────────────────────────────────────────

const activeStreams = new Map<string, StreamEntry>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function errorResponse(
  message: string,
  status = 500,
  extraHeaders: Record<string, string> = {}
): Response {
  return jsonResponse({ error: message }, status, extraHeaders);
}

function channelTempDir(channelNumber: string): string {
  return `${TEMP_DIR_PREFIX}${channelNumber}`;
}

function m3u8Path(channelNumber: string): string {
  return join(channelTempDir(channelNumber), "index.m3u8");
}

function segmentPath(channelNumber: string, segFile: string): string {
  return join(channelTempDir(channelNumber), segFile);
}

/**
 * Wait for a file to exist on disk with polling + timeout.
 */
async function waitForFile(
  filePath: string,
  timeoutMs: number,
  pollMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(filePath)) {
      try {
        const s = await stat(filePath);
        if (s.size > 0) return true;
      } catch {
        // File might be mid-write, keep waiting
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

/**
 * Synchronous recursive mkdir.
 */
function mkdirSyncRecursive(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ─── Startup Cleanup ─────────────────────────────────────────────────────────

/**
 * Clean up any stale temp directories from previous runs.
 */
async function cleanupStaleTempDirs(): Promise<void> {
  try {
    const tmpDir = "/tmp";
    const entries = await readdir(tmpDir);
    const staleDirs = entries.filter(
      (e) => e.startsWith("hdhr-transcode-")
    );
    for (const dir of staleDirs) {
      const fullPath = join(tmpDir, dir);
      try {
        await rm(fullPath, { recursive: true, force: true });
        console.log(`[hdhr-transcoder] Cleaned up stale temp dir: ${fullPath}`);
      } catch (err) {
        console.error(`[hdhr-transcoder] Failed to cleanup ${fullPath}:`, err);
      }
    }
    if (staleDirs.length > 0) {
      console.log(
        `[hdhr-transcoder] Cleaned up ${staleDirs.length} stale temp directory(ies)`
      );
    }
  } catch (err) {
    console.error("[hdhr-transcoder] Error scanning /tmp for stale dirs:", err);
  }
}

// Run cleanup on startup
cleanupStaleTempDirs();

// ─── FFmpeg Process Management ───────────────────────────────────────────────

/**
 * Start an FFmpeg process that transcodes an HDHomerun MPEG-TS stream to HLS.
 */
function startFFmpeg(
  channelNumber: string,
  tunerIp: string,
  quality: string = "medium"
): StreamEntry {
  const tempDir = channelTempDir(channelNumber);

  // Ensure output directory exists
  mkdirSyncRecursive(tempDir);

  const inputUrl = `http://${tunerIp}:5004/auto/v${channelNumber}`;
  const segmentFile = join(tempDir, "segment_%03d.ts");
  const playlistFile = join(tempDir, "index.m3u8");

  const bitrate = QUALITY_BITRATES[quality] ?? QUALITY_BITRATES.medium;
  const bitrateStr = `${bitrate}k`;
  const maxrateStr = `${bitrate}k`;
  const bufsizeStr = `${bitrate * 2}k`;

  console.log(
    `[hdhr-transcoder] Starting FFmpeg for channel ${channelNumber} ` +
      `from ${inputUrl} (quality: ${quality}, bitrate: ${bitrateStr})`
  );

  const args = [
    "-i",
    inputUrl,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-b:v",
    bitrateStr,
    "-maxrate",
    maxrateStr,
    "-bufsize",
    bufsizeStr,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_list_size",
    "6",
    "-hls_flags",
    "delete_segments+append_list",
    "-hls_segment_filename",
    segmentFile,
    playlistFile,
  ];

  const proc = spawn(FFMPEG_PATH, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });

  const entry: StreamEntry = {
    process: proc,
    tempDir,
    lastAccess: Date.now(),
    startedAt: Date.now(),
    tunerIp,
    channelNumber,
    quality,
    failed: false,
  };

  // Drain stderr to prevent buffer blockage
  if (proc.stderr) {
    let stderrBuffer = "";
    proc.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderrBuffer += text;
      // Log errors/warnings
      const lines = text.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        if (
          line.includes("error") ||
          line.includes("Error") ||
          line.includes("Invalid") ||
          line.includes("failed")
        ) {
          console.error(
            `[hdhr-transcoder] FFmpeg ch${channelNumber}: ${line.trim()}`
          );
        }
      }
    });

    // Detect early exit (FFmpeg fails to start)
    proc.on("close", (code, signal) => {
      console.log(
        `[hdhr-transcoder] FFmpeg for channel ${channelNumber} exited ` +
          `(code=${code}, signal=${signal})`
      );
      // If it exited very quickly with an error code, mark as failed
      const uptime = Date.now() - entry.startedAt;
      if (
        (code !== 0 && code !== null && uptime < 5000) ||
        signal !== null
      ) {
        entry.failed = true;
        if (uptime < 5000) {
          console.error(
            `[hdhr-transcoder] FFmpeg for channel ${channelNumber} failed to start. ` +
              `Last stderr: ${stderrBuffer.slice(-500)}`
          );
        }
      }
      // Clean up if still in our map
      const current = activeStreams.get(channelNumber);
      if (current && current.process === proc) {
        activeStreams.delete(channelNumber);
        cleanupChannelDir(channelNumber);
      }
    });
  }

  proc.on("error", (err) => {
    console.error(
      `[hdhr-transcoder] FFmpeg spawn error for channel ${channelNumber}:`,
      err
    );
    entry.failed = true;
    activeStreams.delete(channelNumber);
  });

  activeStreams.set(channelNumber, entry);
  return entry;
}

/**
 * Kill the FFmpeg process for a given channel and clean up.
 */
function stopChannel(channelNumber: string): boolean {
  const entry = activeStreams.get(channelNumber);
  if (!entry) return false;

  console.log(`[hdhr-transcoder] Stopping FFmpeg for channel ${channelNumber}`);

  try {
    entry.process.kill("SIGTERM");
    // Give it a moment, then force kill if needed
    setTimeout(() => {
      try {
        entry.process.kill("SIGKILL");
      } catch {
        // Already dead
      }
    }, 3000);
  } catch {
    // Process might already be dead
  }

  activeStreams.delete(channelNumber);
  cleanupChannelDir(channelNumber);
  return true;
}

/**
 * Remove the temp directory for a channel.
 */
async function cleanupChannelDir(channelNumber: string): Promise<void> {
  const dir = channelTempDir(channelNumber);
  try {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      console.log(
        `[hdhr-transcoder] Cleaned up directory for channel ${channelNumber}`
      );
    }
  } catch (err) {
    console.error(
      `[hdhr-transcoder] Failed to cleanup dir for channel ${channelNumber}:`,
      err
    );
  }
}

// ─── Stale Process Cleanup ──────────────────────────────────────────────────

function cleanupStaleProcesses(): void {
  const now = Date.now();
  for (const [channelNumber, entry] of activeStreams) {
    const elapsed = now - entry.lastAccess;
    if (elapsed > STALE_TIMEOUT_MS) {
      console.log(
        `[hdhr-transcoder] Channel ${channelNumber} stale ` +
          `(${Math.round(elapsed / 1000)}s since last access), stopping`
      );
      stopChannel(channelNumber);
    }
  }
}

// Start periodic cleanup
setInterval(cleanupStaleProcesses, CLEANUP_INTERVAL_MS);

// ─── Request Router ─────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      // ── GET /stream/:channel/index.m3u8 ──────────────────────────
      const m3u8Match = path.match(/^\/stream\/([\d.]+)\/index\.m3u8$/);
      if (m3u8Match && method === "GET") {
        return await handleM3U8(m3u8Match[1], url);
      }

      // ── GET /stream/:channel/segment/:segment ────────────────────
      const segMatch = path.match(
        /^\/stream\/([\d.]+)\/segment\/(segment_\d+\.ts)$/
      );
      if (segMatch && method === "GET") {
        return await handleSegment(segMatch[1], segMatch[2]);
      }

      // ── GET /stream/:channel/segment_NNN.ts ──────────────────────
      // FFmpeg writes relative segment paths (e.g. "segment_000.ts") in the
      // m3u8.  When the proxy-segment endpoint resolves them against the
      // m3u8 base URL, the resulting path is /stream/{ch}/segment_000.ts
      // rather than /stream/{ch}/segment/segment_000.ts.  Handle both.
      const directSegMatch = path.match(
        /^\/stream\/([\d.]+)\/(segment_\d+\.ts)$/
      );
      if (directSegMatch && method === "GET") {
        return await handleSegment(directSegMatch[1], directSegMatch[2]);
      }

      // ── GET /status ─────────────────────────────────────────────
      if (path === "/status" && method === "GET") {
        return handleStatus();
      }

      // ── Health check ────────────────────────────────────────────
      if (path === "/" && method === "GET") {
        return jsonResponse({
          service: "hdhr-transcoder",
          version: "1.0.0",
          status: "running",
          activeStreams: activeStreams.size,
        });
      }

      return errorResponse("Not found", 404);
    } catch (err) {
      console.error("[hdhr-transcoder] Unhandled error:", err);
      return errorResponse("Internal server error", 500);
    }
  },
});

console.log(`[hdhr-transcoder] Service running on http://localhost:${PORT}`);

// ─── Endpoint Handlers ──────────────────────────────────────────────────────

/**
 * GET /stream/:channelNumber/index.m3u8
 *
 * Returns the HLS manifest. Starts an FFmpeg process if one isn't running
 * for this channel. Waits for the m3u8 to be written before responding.
 *
 * Query params:
 *   tunerIp  (required for starting a new stream) — The IP of the HDHomerun tuner
 *   quality  (optional, default "medium") — Controls video bitrate: low (1500k), medium (3000k), high (6000k)
 */
async function handleM3U8(channelNumber: string, url: URL): Promise<Response> {
  const tunerIp = url.searchParams.get("tunerIp");
  const quality = url.searchParams.get("quality") || "medium";

  // Validate quality parameter
  if (quality && !QUALITY_BITRATES[quality]) {
    return errorResponse(
      `Invalid quality "${quality}". Valid values: ${Object.keys(QUALITY_BITRATES).join(", ")}`,
      400
    );
  }

  let entry = activeStreams.get(channelNumber);

  if (entry) {
    // Process already running — update access time
    entry.lastAccess = Date.now();

    // If the tuner IP changed, we need to restart
    if (tunerIp && tunerIp !== entry.tunerIp) {
      console.log(
        `[hdhr-transcoder] Tuner IP changed for channel ${channelNumber}: ` +
          `${entry.tunerIp} → ${tunerIp}, restarting`
      );
      stopChannel(channelNumber);
      entry = undefined;
    }

    // If the quality changed, we need to restart
    if (entry && quality !== entry.quality) {
      console.log(
        `[hdhr-transcoder] Quality changed for channel ${channelNumber}: ` +
          `${entry.quality} → ${quality}, restarting`
      );
      stopChannel(channelNumber);
      entry = undefined;
    }
  }

  if (!entry) {
    // Need to start FFmpeg
    if (!tunerIp) {
      return errorResponse(
        "Missing required query parameter: tunerIp. " +
          "Usage: /stream/<channel>/index.m3u8?tunerIp=<ip>&quality=<low|medium|high>",
        400
      );
    }

    entry = startFFmpeg(channelNumber, tunerIp, quality);

    // If FFmpeg failed to start, return 503
    if (entry.failed) {
      return errorResponse(
        `FFmpeg failed to start for channel ${channelNumber}. ` +
          `Check that FFmpeg is installed and the tuner at ${tunerIp} is reachable.`,
        503
      );
    }
  }

  // Wait for the m3u8 file to be created by FFmpeg
  const m3u8File = m3u8Path(channelNumber);
  const found = await waitForFile(
    m3u8File,
    M3U8_WAIT_TIMEOUT_MS,
    M3U8_POLL_INTERVAL_MS
  );

  if (!found) {
    // Check if the process is still alive or failed
    const currentEntry = activeStreams.get(channelNumber);
    if (!currentEntry || currentEntry.failed) {
      return errorResponse(
        `FFmpeg process for channel ${channelNumber} exited unexpectedly. ` +
          `Check that the HDHomerun tuner at ${tunerIp} is reachable.`,
        503
      );
    }
    return errorResponse(
      `Timeout waiting for HLS manifest for channel ${channelNumber}. ` +
        `The tuner may be unreachable or the channel may be unavailable.`,
      504
    );
  }

  try {
    const content = await readFile(m3u8File, "utf-8");
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders(),
      },
    });
  } catch (err) {
    console.error(
      `[hdhr-transcoder] Error reading m3u8 for channel ${channelNumber}:`,
      err
    );
    return errorResponse("Failed to read HLS manifest", 500);
  }
}

/**
 * GET /stream/:channelNumber/segment/:segment
 *
 * Serves an HLS .ts segment file from the temp directory.
 */
async function handleSegment(
  channelNumber: string,
  segFile: string
): Promise<Response> {
  const entry = activeStreams.get(channelNumber);

  // Update last accessed time
  if (entry) {
    entry.lastAccess = Date.now();
  }

  const filePath = segmentPath(channelNumber, segFile);

  try {
    const content = await readFile(filePath);
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "video/mp2t",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders(),
      },
    });
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      // Segment not found — might have been cleaned up or not yet created
      return errorResponse(
        `Segment ${segFile} not found for channel ${channelNumber}`,
        404
      );
    }
    console.error(
      `[hdhr-transcoder] Error reading segment ${segFile} for channel ${channelNumber}:`,
      err
    );
    return errorResponse("Failed to read segment", 500);
  }
}

/**
 * GET /status
 *
 * Returns status of active transcode sessions.
 */
function handleStatus(): Response {
  const now = Date.now();
  const streams = Array.from(activeStreams.entries()).map(
    ([channelNumber, entry]) => ({
      channelNumber,
      tunerIp: entry.tunerIp,
      quality: entry.quality,
      tempDir: entry.tempDir,
      uptime: Math.round((now - entry.startedAt) / 1000),
      lastAccessAgo: Math.round((now - entry.lastAccess) / 1000),
      pid: entry.process.pid,
      failed: entry.failed,
    })
  );

  return jsonResponse({
    status: "ok",
    activeStreams: streams.length,
    streams,
    config: {
      staleTimeoutSec: STALE_TIMEOUT_MS / 1000,
      cleanupIntervalSec: CLEANUP_INTERVAL_MS / 1000,
      m3u8WaitTimeoutSec: M3U8_WAIT_TIMEOUT_MS / 1000,
      qualityPresets: QUALITY_BITRATES,
      tempDirPattern: `${TEMP_DIR_PREFIX}{channel}`,
    },
  });
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(
    `\n[hdhr-transcoder] Received ${signal}, shutting down gracefully...`
  );

  const channels = Array.from(activeStreams.keys());
  for (const ch of channels) {
    stopChannel(ch);
  }

  server.stop();
  console.log(
    `[hdhr-transcoder] Stopped ${channels.length} active stream(s). Goodbye.`
  );
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
