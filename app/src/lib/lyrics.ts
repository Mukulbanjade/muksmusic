// Lyrics via LRCLIB (https://lrclib.net) — free, open, no API key. Returns
// time-synced lyrics when available (for Spotify/Apple-Music-style highlighting),
// falling back to plain text. Fetched directly on-device.

import type { Track } from "@/types";

export type LyricLine = { timeMs: number; text: string };
export type Lyrics = {
  synced: LyricLine[] | null; // timed lines, or null if only plain is available
  plain: string | null;
};

const cache = new Map<string, Lyrics | null>();

/** Parse an LRC string ("[mm:ss.xx] text") into timed lines. */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const matches = [...raw.matchAll(/\[(\d+):(\d+)(?:\.(\d+))?\]/g)];
    if (matches.length === 0) continue;
    const text = raw.replace(/\[(\d+):(\d+)(?:\.(\d+))?\]/g, "").trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      lines.push({ timeMs: (min * 60 + sec) * 1000 + frac, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function toLyrics(rec: any): Lyrics | null {
  if (!rec) return null;
  const synced =
    typeof rec.syncedLyrics === "string" && rec.syncedLyrics.trim()
      ? parseLrc(rec.syncedLyrics)
      : null;
  const plain =
    typeof rec.plainLyrics === "string" && rec.plainLyrics.trim()
      ? rec.plainLyrics.trim()
      : null;
  if (!synced && !plain) return null;
  return { synced: synced && synced.length > 0 ? synced : null, plain };
}

/** Fetch lyrics for a track. Tries an exact match, then a fuzzy search. */
export async function getLyrics(track: Track): Promise<Lyrics | null> {
  if (cache.has(track.id)) return cache.get(track.id) ?? null;

  const durationSec = track.durationMs ? Math.round(track.durationMs / 1000) : 0;
  // Clean "Artist - Title" noise out of the title for better matching.
  const title = track.title.replace(/^.*?-\s*/, "").trim() || track.title;
  const artist = track.artist;

  const headers = { "User-Agent": "muksmusic (personal music app)" };
  let result: Lyrics | null = null;

  try {
    // 1. Exact get (best when metadata is clean).
    const getUrl =
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}` +
      `&track_name=${encodeURIComponent(title)}` +
      (durationSec ? `&duration=${durationSec}` : "");
    const res = await fetch(getUrl, { headers });
    if (res.ok) result = toLyrics(await res.json());

    // 2. Fuzzy search fallback — pick the closest by duration.
    if (!result) {
      const q = `${artist} ${title}`.trim();
      const sr = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
        { headers },
      );
      if (sr.ok) {
        const arr = await sr.json();
        if (Array.isArray(arr) && arr.length > 0) {
          const best = durationSec
            ? arr.reduce((a: any, b: any) =>
                Math.abs((b.duration || 0) - durationSec) <
                Math.abs((a.duration || 0) - durationSec)
                  ? b
                  : a,
              )
            : arr[0];
          result = toLyrics(best);
        }
      }
    }
  } catch {
    result = null;
  }

  cache.set(track.id, result);
  return result;
}

/** Index of the active line for a given playback position. */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i;
    else break;
  }
  return idx;
}
