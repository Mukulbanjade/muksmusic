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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
import {
  cookieFilePath,
  getVersion,
  search,
  spawnAudioStream,
  YT_DLP,
} from "./ytdlp.js";

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

function handleDownload(url, res) {
  const id = (url.searchParams.get("id") || "").trim();
  if (!/^[\w-]{6,20}$/.test(id)) {
    return sendJson(res, 400, { error: "invalid or missing ?id=" });
  }
  console.log(`[download] ${id}`);
  const child = spawnAudioStream(youtubeUrl(id));
  let errBuf = "";
  let started = false;

  res.on("close", () => {
    if (!child.killed) child.kill("SIGKILL");
  });

  child.stderr.on("data", (d) => (errBuf += d.toString()));
  child.stdout.once("data", () => {
    started = true;
    res.writeHead(200, {
      "content-type": "audio/mp4",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    });
  });
  child.stdout.on("data", (chunk) => res.write(chunk));

  child.on("error", (e) => {
    console.error("[download] spawn error", e.message);
    if (!started && !res.headersSent) sendJson(res, 500, { error: e.message });
  });
  child.on("close", (code) => {
    if (started) {
      res.end();
    } else if (!res.headersSent) {
      console.error("[download] failed", errBuf.trim());
      sendJson(res, 502, {
        error: "download failed",
        detail: errBuf.trim().slice(0, 500),
      });
    }
  });
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
      return handleDownload(url, res);
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
