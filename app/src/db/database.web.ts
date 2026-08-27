// Web implementation of the library store. Metro resolves this file (over
// database.ts) when bundling for web, so expo-sqlite — which pulls in a WASM
// module that can't be statically exported — is never included in the web build.
//
// The library lives in memory and is persisted to localStorage, making the
// web/PWA build a real, durable app: saved songs, playlists, and likes survive
// reloads. On iOS/Android, database.ts (SQLite) is used instead.

import type { Playlist, Track } from "@/types";

const LIKED_PLAYLIST_ID = "liked";
const MEM_KEY = "muksmusic.library.v1";

const mem = {
  tracks: [] as Track[],
  playlists: [] as Playlist[],
  playlistTracks: [] as { playlistId: string; trackId: string; position: number }[],
};

(function hydrate() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(MEM_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    mem.tracks = Array.isArray(data.tracks) ? data.tracks : [];
    mem.playlists = Array.isArray(data.playlists) ? data.playlists : [];
    mem.playlistTracks = Array.isArray(data.playlistTracks) ? data.playlistTracks : [];
  } catch {
    /* start empty on any parse error */
  }
})();

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(mem));
  } catch {
    /* storage full / unavailable — stay in-memory */
  }
}

// ---- Tracks -------------------------------------------------------------

export async function insertTrack(t: Track): Promise<void> {
  mem.tracks = [t, ...mem.tracks.filter((x) => x.id !== t.id)];
  persist();
}

export async function getAllTracks(): Promise<Track[]> {
  return [...mem.tracks].sort((a, b) => b.addedAt - a.addedAt);
}

export async function getTrack(id: string): Promise<Track | null> {
  return mem.tracks.find((t) => t.id === id) ?? null;
}

export async function getDownloadedIds(): Promise<Set<string>> {
  return new Set(mem.tracks.map((t) => t.id));
}

export async function deleteTrack(id: string): Promise<void> {
  mem.tracks = mem.tracks.filter((t) => t.id !== id);
  mem.playlistTracks = mem.playlistTracks.filter((pt) => pt.trackId !== id);
  persist();
}

export async function setLiked(id: string, liked: boolean): Promise<void> {
  const t = mem.tracks.find((x) => x.id === id);
  if (t) t.liked = liked;
  persist();
}

export async function getLikedTracks(): Promise<Track[]> {
  return mem.tracks.filter((t) => t.liked).sort((a, b) => b.addedAt - a.addedAt);
}

// ---- Playlists ----------------------------------------------------------

export async function createPlaylist(name: string): Promise<Playlist> {
  const playlist: Playlist = {
    id: `pl_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    name,
    createdAt: Date.now(),
  };
  mem.playlists = [playlist, ...mem.playlists];
  persist();
  return playlist;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const p = mem.playlists.find((x) => x.id === id);
  if (p) p.name = name;
  persist();
}

export async function deletePlaylist(id: string): Promise<void> {
  mem.playlists = mem.playlists.filter((p) => p.id !== id);
  mem.playlistTracks = mem.playlistTracks.filter((pt) => pt.playlistId !== id);
  persist();
}

export async function getPlaylists(): Promise<Playlist[]> {
  return mem.playlists.map((p) => ({
    ...p,
    trackCount: mem.playlistTracks.filter((pt) => pt.playlistId === p.id).length,
  }));
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  return mem.playlists.find((p) => p.id === id) ?? null;
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  if (
    !mem.playlistTracks.some(
      (pt) => pt.playlistId === playlistId && pt.trackId === trackId,
    )
  ) {
    const position = mem.playlistTracks.filter(
      (pt) => pt.playlistId === playlistId,
    ).length;
    mem.playlistTracks.push({ playlistId, trackId, position });
  }
  persist();
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  mem.playlistTracks = mem.playlistTracks.filter(
    (pt) => !(pt.playlistId === playlistId && pt.trackId === trackId),
  );
  persist();
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  return mem.playlistTracks
    .filter((pt) => pt.playlistId === playlistId)
    .sort((a, b) => a.position - b.position)
    .map((pt) => mem.tracks.find((t) => t.id === pt.trackId))
    .filter((t): t is Track => !!t);
}

export { LIKED_PLAYLIST_ID };
