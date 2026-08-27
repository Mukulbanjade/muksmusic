// Locates a usable yt-dlp binary and exposes helpers for searching and
// streaming audio. The phone never talks to yt-dlp directly; it only talks to
// this server, which shells out to yt-dlp on the host machine.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function resolveBinary() {
  // 1. Explicit override
  if (process.env.YT_DLP_PATH && existsSync(process.env.YT_DLP_PATH)) {
    return process.env.YT_DLP_PATH;
  }
  // 2. A Homebrew / pip yt-dlp on the usual paths. Preferred: it starts in ~1s,
  //    whereas the vendored self-contained binary is re-scanned by macOS
  //    Gatekeeper on every launch (~35s), which is far too slow for a server.
  for (const p of ["/usr/local/bin/yt-dlp", "/opt/homebrew/bin/yt-dlp"]) {
    if (existsSync(p)) return p;
  }
  // 3. The self-contained binary vendored into this server (server/bin/yt-dlp).
  //    Slow to start, but works with zero setup.
  const vendored = fileURLToPath(new URL("../bin/yt-dlp", import.meta.url));
  if (existsSync(vendored)) return vendored;
  // 4. Whatever else is on PATH.
  return "yt-dlp";
}

export const YT_DLP = resolveBinary();

// From a datacenter IP (Fly/Render/Railway), YouTube often demands a signed-in
// session. If a cookies file is provided, pass it to every yt-dlp call so the
// server can act as a logged-in user. Set YTDLP_COOKIES to the file path, or
// drop the exported cookies at server/cookies.txt.
function cookieArgs() {
  const candidates = [
    process.env.YTDLP_COOKIES, // explicit path
    "/etc/secrets/cookies.txt", // Render Secret File
    fileURLToPath(new URL("../cookies.txt", import.meta.url)), // server/cookies.txt
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return ["--cookies", p];
  }
  return [];
}

/** Run yt-dlp and collect stdout as a string. Rejects on non-zero exit. */
export function runYtDlp(args, { timeoutMs = 60_000 } = {}) {
  const fullArgs = [...cookieArgs(), ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP, fullArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

/** Spawn yt-dlp streaming audio bytes to stdout (for the /download route). */
export function spawnAudioStream(url) {
  // 140 = 128kbps m4a (AAC), already muxed → no ffmpeg needed.
  return spawn(
    YT_DLP,
    [
      ...cookieArgs(),
      "-f",
      "140/bestaudio[ext=m4a]/bestaudio",
      "--no-playlist",
      "--no-warnings",
      "-o",
      "-",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

export async function getVersion() {
  try {
    return (await runYtDlp(["--version"], { timeoutMs: 45_000 })).trim();
  } catch {
    return null;
  }
}

/** Pick the largest thumbnail URL from a yt-dlp entry. */
function pickThumbnail(entry) {
  if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
    const sorted = [...entry.thumbnails].sort(
      (a, b) => (b.width || 0) - (a.width || 0),
    );
    return sorted[0].url;
  }
  if (entry.thumbnail) return entry.thumbnail;
  if (entry.id) return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
  return null;
}

/**
 * Search YouTube and return normalized, ranked, de-duplicated track candidates.
 *
 * @param {string} query
 * @param {number} limit
 * @param {Array<{title:string,artist:string,album:string|null}>} canonical
 *   Optional MusicBrainz recordings used to enrich (clean artist/album) and
 *   boost YouTube results that correspond to a real, catalogued song.
 */
export async function search(query, limit = 15, canonical = []) {
  // Over-fetch so the quality filter has candidates to rank and drop from.
  const fetchCount = Math.min(limit * 2 + 5, 40);
  const stdout = await runYtDlp(
    [
      "--dump-json",
      "--flat-playlist",
      "--no-warnings",
      `ytsearch${fetchCount}:${query}`,
    ],
    { timeoutMs: 45_000 },
  );

  const candidates = [];
  let rank = 0; // original YouTube position (0 = best match)
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!entry.id) continue;

    const rawTitle = entry.title || "Unknown title";
    const uploader = entry.uploader || entry.channel || "";
    const durationSec = entry.duration || null;

    // Hard-drop obvious non-songs (reactions, karaoke, hour-loops, edits…).
    if (isJunk(rawTitle, durationSec)) {
      rank++;
      continue;
    }

    let title = cleanTitle(rawTitle);
    let artist = cleanArtist(uploader) || "Unknown artist";
    let album = null;
    let score = scoreEntry(rawTitle, uploader, durationSec, rank, query);

    const ytThumb = pickThumbnail(entry);
    let artworkUrl = ytThumb;
    let fallbackArtworkUrl = null;

    // Enrich against MusicBrainz: if this YouTube upload matches a real
    // catalogued recording, overlay its clean artist/album and give it a gentle
    // boost. We keep the YouTube title and dedup so the solid YouTube-based
    // ranking is preserved — the metadata is purely additive.
    const match = matchCanonical(rawTitle, uploader, canonical);
    if (match) {
      artist = match.artist;
      album = match.album;
      score += 18; // nudge verified real songs up, don't override
      // Prefer a real square album cover from the Cover Art Archive, keeping
      // the YouTube thumbnail as a fallback (CAA 404s for some releases).
      if (match.releaseId) {
        artworkUrl = `https://coverartarchive.org/release/${match.releaseId}/front-500`;
        fallbackArtworkUrl = ytThumb;
      }
    }

    candidates.push({
      id: entry.id,
      title,
      artist,
      album,
      durationMs: durationSec ? Math.round(durationSec * 1000) : null,
      artworkUrl,
      fallbackArtworkUrl,
      source: "youtube",
      _score: score,
      _dupKey: dedupKey(rawTitle, uploader),
    });
    rank++;
  }

  // De-duplicate near-identical songs, keeping the highest-scoring one.
  const byKey = new Map();
  for (const c of candidates) {
    const existing = byKey.get(c._dupKey);
    if (!existing || c._score > existing._score) byKey.set(c._dupKey, c);
  }

  return [...byKey.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, _dupKey, ...track }) => track);
}

/** Normalize a string for loose comparison (lowercase, punctuation-free). */
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common words that carry no artist identity, so they must not trigger a match.
const STOPWORDS = new Set([
  "the", "and", "feat", "ft", "with", "of", "in", "on", "a", "an",
  "le", "la", "el", "los", "las", "official", "music", "band",
]);

/**
 * Find the canonical recording (if any) that a YouTube upload represents.
 * The canonical title must appear in the YouTube title, and among all such
 * candidates we pick the one whose DISTINCTIVE artist words best match the
 * YouTube title or uploader — so "The Weeknd – Blinding Lights" resolves to
 * The Weeknd, not some other band that also released a "Blinding Lights".
 */
function matchCanonical(rawTitle, uploader, canonical) {
  if (!canonical || canonical.length === 0) return null;
  const t = norm(rawTitle);
  const haystack = `${t} ${norm(uploader)}`;

  let best = null;
  let bestScore = -1;
  for (const rec of canonical) {
    const recTitle = norm(rec.title);
    if (!recTitle || recTitle.length < 2) continue;
    if (!t.includes(recTitle)) continue; // the song's title must be present

    const artistWords = norm(rec.artist)
      .split(" ")
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
    const hits = artistWords.filter((w) => haystack.includes(w)).length;

    // If the artist has distinctive words, require at least one to match.
    if (artistWords.length > 0 && hits === 0) continue;

    // Prefer more artist-word hits, then MusicBrainz's own relevance score.
    const s = hits * 1000 + (rec.score || 0);
    if (s > bestScore) {
      best = rec;
      bestScore = s;
    }
  }
  return best;
}

// Titles/channels that signal an official/high-quality upload.
const OFFICIAL_UPLOADER = /vevo|- topic$|official/i;
const OFFICIAL_TITLE = /official (music )?(video|audio)/i;

// Clearly-not-the-song content we never want in a music library.
const JUNK_TITLE =
  /\b(cover|reaction|react|karaoke|instrumental|tutorial|how to play|guitar lesson|piano tutorial|nightcore|8d audio|slowed \+? ?reverb|sped ?up|bass boosted|mashup|full album|jukebox|non ?stop|megamix|ringtone|whatsapp status|loop(ed)?|1 ?hour|10 ?hours?|trailer|teaser|flash ?mob|behind the scenes|making of|parody|medley)\b/i;

// Soft-negative signals (edits, alt versions) — penalized, not always dropped.
const SOFT_NEGATIVE = /\b(remix|live|lyric[s]?|remaster(ed)?|extended|acoustic|unplugged|male version|female version|reverb)\b/i;

/** Hard filter: true if this entry should never appear as a song. */
function isJunk(title, durationSec) {
  if (JUNK_TITLE.test(title)) return true;
  // Hour-long items and < 45s clips/shorts are almost never the track.
  if (durationSec != null && (durationSec > 900 || durationSec < 45)) return true;
  return false;
}

/** Higher is better. Combines official signals, title match, duration, position. */
function scoreEntry(title, uploader, durationSec, rank, query) {
  let score = 100 - rank * 4; // respect YouTube's own ranking, gently

  if (OFFICIAL_UPLOADER.test(uploader)) score += 40;
  if (/- topic$/i.test(uploader)) score += 15; // YouTube Music official audio
  if (OFFICIAL_TITLE.test(title)) score += 20;
  if (SOFT_NEGATIVE.test(title)) score -= 25;

  // Typical single length (1.5–6 min) is a good sign; extremes are penalized.
  if (durationSec != null) {
    if (durationSec >= 90 && durationSec <= 360) score += 15;
    else if (durationSec > 600) score -= 15;
  }

  // Reward overlap between the query words and the title.
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const hits = words.filter((w) => t.includes(w)).length;
  if (words.length) score += Math.round((hits / words.length) * 20);

  return score;
}

/** Normalized key so "Song (Official Video)" and "Song [Lyrics]" collapse. */
function dedupKey(title, uploader) {
  const base = title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "") // drop bracketed qualifiers
    .replace(/official|video|audio|lyrics?|hd|4k|remaster(ed)?/g, "")
    .replace(/feat\.?.*$/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ") // keep letters/numbers of any script
    .replace(/\s+/g, " ")
    .trim();
  const who = cleanArtist(uploader).toLowerCase().replace(/\s+/g, " ").trim();
  return `${who}::${base}`;
}

// YouTube titles are noisy ("Artist - Title (Official Video) [HD]"). Trim the
// most common cruft so the library looks tidy.
function cleanTitle(title) {
  return title
    .replace(/\((official\s*)?(music\s*)?(lyric[s]?\s*)?video\)/gi, "")
    .replace(/\[(official\s*)?(music\s*)?(lyric[s]?\s*)?video\]/gi, "")
    .replace(/\(audio\)/gi, "")
    .replace(/\[audio\]/gi, "")
    .replace(/\(official audio\)/gi, "")
    .replace(/\s*\|\s*.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanArtist(name) {
  return name.replace(/\s*-?\s*topic$/i, "").trim();
}
