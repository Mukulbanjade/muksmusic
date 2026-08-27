// MusicBrainz metadata client. Free, open, no API key — just requires a
// descriptive User-Agent and courtesy rate limiting (~1 req/sec).
//
// We make ONE search call per user query to fetch canonical song identities
// (real title / artist / album). Those are then cross-referenced in memory
// against the YouTube results to clean up names and rank real songs higher.

const MB_ENDPOINT = "https://musicbrainz.org/ws/2/recording";
const USER_AGENT = "muksmusic/1.0.0 ( personal self-hosted music app )";

// Small in-memory cache to avoid re-hitting MusicBrainz (rate limited ~1/sec)
// for repeated queries within a session.
const cache = new Map(); // key -> { at, data }
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Search MusicBrainz recordings for a query.
 * Returns canonical tracks: { title, artist, album }.
 */
export async function mbSearchRecordings(query, limit = 12) {
  const key = query.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const url =
    `${MB_ENDPOINT}?query=${encodeURIComponent(query)}` +
    `&fmt=json&limit=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = await res.json();
    const recordings = Array.isArray(json.recordings) ? json.recordings : [];
    const data = recordings
      .map((rec) => {
        const artist = (rec["artist-credit"] || [])
          .map((c) => c.name)
          .join("")
          .trim();
        const release =
          Array.isArray(rec.releases) && rec.releases.length > 0
            ? rec.releases[0]
            : null;
        return {
          title: (rec.title || "").trim(),
          artist,
          album: release && release.title ? release.title.trim() : null,
          releaseId: release && release.id ? release.id : null,
          score: rec.score || 0,
        };
      })
      .filter((r) => r.title && r.artist);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
