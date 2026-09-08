// muksmusic-server
// A tiny local backend that lets the muksmusic iOS app scrape music.
// iOS can't run yt-dlp on-device, so the phone asks this server to search and
// to stream audio, then saves the bytes into its own local library.
//
//   GET /health           -> { ok, ytDlp }
//   GET /search?q=&limit= -> [{ id, title, artist, durationMs, artworkUrl }]
//   GET /download?id=     -> audio/mp4 stream of the track (phone stores it)
//   GET /art?url=         -> image proxy for artwork
//
// Start with `npm start`. Point the app's Settings screen at http://<mac-ip>:8787.

import http from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
import {
  cookieFilePath,
  downloadToLibrary,
  getVersion,
  search,
  YT_DLP,
} from "./ytdlp.js";

// Downloaded songs are cached here (a persistent library on the server). Mount a
// Docker volume at /app/library to keep them across container rebuilds.
const LIBRARY_DIR = fileURLToPath(new URL("../library", import.meta.url));
try {
  mkdirSync(LIBRARY_DIR, { recursive: true });
} catch {
  /* ignore */
}

// Temporary diagnostic: where did the host put the cookies Secret File?
function cookieDiag() {
  const probe = [
    "/etc/secrets/cookies.txt",
    "/app/cookies.txt",
    `${process.cwd()}/cookies.txt`,
    "/etc/secrets",
  ];
  const checks = {};
  for (const p of probe) checks[p] = existsSync(p);
  const listDir = (d) => {
    try {
      return readdirSync(d);
    } catch (e) {
      return `err:${e.code || e.message}`;
    }
  };
  return {
    cwd: process.cwd(),
    checks,
    etcSecrets: listDir("/etc/secrets"),
    cwdFiles: listDir(process.cwd()).filter?.((f) => /cookie|txt/.test(f)) ?? [],
    env_YTDLP_COOKIES: process.env.YTDLP_COOKIES || null,
  };
}
import { mbSearchRecordings } from "./musicbrainz.js";
import { getPlaylist as getSpotifyPlaylist } from "./spotify.js";
import { analyzeTrack } from "./analyze.js";
import { writeFileSync } from "node:fs";

// Robust cookies delivery that doesn't depend on how the host mounts files:
// paste the base64 of cookies.txt into the YTDLP_COOKIES_B64 env var, and we
// write it to a real file at startup and point yt-dlp at it.
if (process.env.YTDLP_COOKIES_B64) {
  try {
    const p = "/tmp/muks-cookies.txt";
    writeFileSync(p, Buffer.from(process.env.YTDLP_COOKIES_B64, "base64"));
    process.env.YTDLP_COOKIES = p;
    console.log(`[cookies] wrote ${p} from YTDLP_COOKIES_B64`);
  } catch (e) {
    console.error("[cookies] failed to decode YTDLP_COOKIES_B64:", e.message);
  }
}

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function youtubeUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

async function handleHealth(res) {
  const version = await getVersion();
  const cookies = cookieFilePath();
  sendJson(res, 200, {
    ok: version != null,
    ytDlp: version,
    binary: YT_DLP,
    cookies: cookies ? { found: true, path: cookies } : { found: false },
    diag: cookieDiag(),
    name: "muksmusic-server",
  });
}

async function handleSearch(url, res) {
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 15, 30);
  if (!q) return sendJson(res, 400, { error: "missing query ?q=" });
  try {
    // Fetch canonical metadata (best-effort) and the YouTube audio sources in
    // parallel; enrichment happens inside search() using the canonical list.
    const canonical = await mbSearchRecordings(q).catch(() => []);
    const tracks = await search(q, limit, canonical);
    sendJson(res, 200, { tracks });
  } catch (err) {
    console.error("[search]", err.message);
    sendJson(res, 502, { error: "search failed", detail: err.message });
  }
}

/** Serve a local audio file, honoring HTTP Range requests (for seeking). */
function serveAudioFile(filePath, req, res) {
  const total = statSync(filePath).size;
  const range = req.headers.range;
  const baseHeaders = {
    "content-type": "audio/mp4",
    "access-control-allow-origin": "*",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=604800",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;
    if (start > end || start >= total) {
      res.writeHead(416, { "content-range": `bytes */${total}` });
      return res.end();
    }
    res.writeHead(206, {
      ...baseHeaders,
      "content-range": `bytes ${start}-${end}/${total}`,
      "content-length": end - start + 1,
    });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...baseHeaders, "content-length": total });
    createReadStream(filePath).pipe(res);
  }
}

function handleDownload(url, req, res) {
  const id = (url.searchParams.get("id") || "").trim();
  if (!/^[\w-]{6,20}$/.test(id)) {
    return sendJson(res, 400, { error: "invalid or missing ?id=" });
  }
  const cached = join(LIBRARY_DIR, `${id}.m4a`);

  // Fast path: already downloaded → serve from disk (instant, correct duration).
  if (existsSync(cached)) {
    return serveAudioFile(cached, req, res);
  }

  // First time: download + remux to a proper m4a, cache it, then serve.
  console.log(`[download] fetching ${id}`);
  downloadToLibrary(youtubeUrl(id), id, LIBRARY_DIR)
    .then((path) => serveAudioFile(path, req, res))
    .catch((e) => {
      console.error("[download] failed", e.message);
      if (!res.headersSent) {
        sendJson(res, 502, { error: "download failed", detail: e.message });
      }
    });
}

async function handleAnalyze(url, res) {
  const id = (url.searchParams.get("id") || "").trim();
  if (!/^[\w-]{6,20}$/.test(id)) {
    return sendJson(res, 400, { error: "invalid or missing ?id=" });
  }
  try {
    const result = await analyzeTrack(id, LIBRARY_DIR);
    sendJson(res, 200, result);
  } catch (err) {
    console.error("[analyze]", err.message);
    sendJson(res, 502, { error: "analyze failed", detail: err.message });
  }
}

async function handleSpotify(url, res) {
  const link = (url.searchParams.get("url") || "").trim();
  if (!link) return sendJson(res, 400, { error: "missing ?url=" });
  try {
    const playlist = await getSpotifyPlaylist(link);
    sendJson(res, 200, playlist);
  } catch (err) {
    console.error("[spotify]", err.message);
    sendJson(res, 502, { error: "spotify import failed", detail: err.message });
  }
}

async function handleArt(url, res) {
  const target = url.searchParams.get("url");
  if (!target || !/^https?:\/\//.test(target)) {
    return sendJson(res, 400, { error: "invalid ?url=" });
  }
  try {
    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body) {
      return sendJson(res, 502, { error: "art fetch failed" });
    }
    res.writeHead(200, {
      "content-type": upstream.headers.get("content-type") || "image/jpeg",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=86400",
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    sendJson(res, 502, { error: "art proxy error", detail: err.message });
  }
}

// ---- Static web UI --------------------------------------------------------
// Serve the built web app (Expo web export) so the whole thing — UI + API —
// runs from this one server. Files live in ../web (i.e. /app/web in Docker).
const WEB_DIR = fileURLToPath(new URL("../web", import.meta.url));
const HAS_WEB = existsSync(join(WEB_DIR, "index.html"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function serveStatic(pathname, res) {
  if (!HAS_WEB) return sendJson(res, 404, { error: "not found" });

  // Resolve within WEB_DIR, guarding against path traversal.
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(WEB_DIR, rel);
  if (!filePath.startsWith(WEB_DIR)) filePath = join(WEB_DIR, "index.html");

  // Directory or missing file → serve index.html (single-page app).
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(WEB_DIR, "index.html");
  }

  try {
    const body = readFileSync(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] || "application/octet-stream",
      "cache-control": filePath.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=86400",
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "*",
    });
    return res.end();
  }

  switch (url.pathname) {
    case "/health":
      return handleHealth(res);
    case "/search":
      return handleSearch(url, res);
    case "/download":
      return handleDownload(url, req, res);
    case "/spotify":
      return handleSpotify(url, res);
    case "/analyze":
      return handleAnalyze(url, res);
    case "/art":
      return handleArt(url, res);
    default:
      // Anything else is the web UI (or its assets); falls back to a 404 JSON
      // when no web build is bundled.
      return serveStatic(url.pathname, res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🎵  muksmusic-server listening on http://${HOST}:${PORT}`);
  console.log(`    yt-dlp binary: ${YT_DLP}`);
  console.log(`    On your iPhone, set the server URL to http://<this-mac-ip>:${PORT}\n`);
});
