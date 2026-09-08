// Read a public Spotify playlist's track list so the app can find + download
// each song through yt-dlp. Spotify hosts no audio, so we only take metadata
// (title, artist, album, duration) here.
//
// Two sources:
//   1. Official Web API — used when SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET
//      are set. Reliable and returns the whole playlist.
//   2. Public embed page — no credentials needed, good enough for personal use
//      (may only include the first ~100 tracks of very large playlists).

/** Pull the playlist id out of any Spotify playlist URL or URI. */
export function parsePlaylistId(input) {
  if (!input) return null;
  const s = String(input).trim();
  let m = s.match(/playlist[/:]([A-Za-z0-9]+)/);
  if (m) return m[1];
  // Bare id.
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  return null;
}

let tokenCache = { token: null, expires: 0 };

async function getApiToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token failed (${res.status})`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expires: Date.now() + (json.expires_in || 3600) * 1000 - 60_000,
  };
  return tokenCache.token;
}

async function fromApi(id, token) {
  const headers = { authorization: `Bearer ${token}` };
  const meta = await fetch(
    `https://api.spotify.com/v1/playlists/${id}?fields=name`,
    { headers },
  );
  if (!meta.ok) throw new Error(`Spotify playlist not found (${meta.status})`);
  const name = (await meta.json()).name || "Spotify playlist";

  const tracks = [];
  let url =
    `https://api.spotify.com/v1/playlists/${id}/tracks` +
    `?fields=next,items(track(name,artists(name),album(name),duration_ms))&limit=100`;
  while (url) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Spotify tracks failed (${r.status})`);
    const page = await r.json();
    for (const it of page.items || []) {
      const t = it.track;
      if (!t || !t.name) continue;
      tracks.push({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(", "),
        album: t.album?.name || null,
        durationMs: t.duration_ms || 0,
      });
    }
    url = page.next;
  }
  return { name, tracks };
}

/** Recursively find the first object that has a `trackList` array. */
function findTrackList(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.trackList)) return node;
  for (const key of Object.keys(node)) {
    const found = findTrackList(node[key]);
    if (found) return found;
  }
  return null;
}

async function fromEmbed(id) {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { "user-agent": "Mozilla/5.0 muksmusic" },
  });
  if (!res.ok) throw new Error(`Spotify embed failed (${res.status})`);
  const html = await res.text();
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("Could not read playlist (Spotify page format changed)");
  const data = JSON.parse(m[1]);
  const entity = findTrackList(data);
  if (!entity) throw new Error("Playlist appears empty or private");

  const name = entity.name || entity.title || "Spotify playlist";
  const tracks = [];
  for (const t of entity.trackList) {
    if (!t || !t.title) continue;
    tracks.push({
      title: t.title,
      artist: t.subtitle || "",
      album: null,
      durationMs: typeof t.duration === "number" ? t.duration : 0,
    });
  }
  return { name, tracks };
}

/** Get { name, tracks:[{title,artist,album,durationMs}] } for a playlist URL. */
export async function getPlaylist(urlOrId) {
  const id = parsePlaylistId(urlOrId);
  if (!id) throw new Error("That doesn't look like a Spotify playlist link");

  const token = await getApiToken().catch(() => null);
  if (token) {
    try {
      return await fromApi(id, token);
    } catch (e) {
      // Fall through to the embed if the API path fails for any reason.
      console.error("[spotify] api failed, trying embed:", e.message);
    }
  }
  return fromEmbed(id);
}
