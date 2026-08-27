import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

import type { Playlist, Track } from "@/types";

const LIKED_PLAYLIST_ID = "liked"; // reserved id, not a real playlist row
const isWeb = Platform.OS === "web";

// ---------------------------------------------------------------------------
// Web store: browsers have no expo-sqlite, so we keep the library in memory and
// persist it to localStorage. That makes the web/PWA build a real, durable app
// (your saved songs, playlists, and likes survive reloads). On iOS the SQLite
// path below is used instead.
// ---------------------------------------------------------------------------
const MEM_KEY = "muksmusic.library.v1";

const mem = {
  tracks: [] as Track[],
  playlists: [] as Playlist[],
  playlistTracks: [] as { playlistId: string; trackId: string; position: number }[],
};

function hydrateMem() {
  if (!isWeb || typeof localStorage === "undefined") return;
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
}

function persistMem() {
  if (!isWeb || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MEM_KEY, JSON.stringify(mem));
  } catch {
    /* storage full / unavailable — stay in-memory */
  }
}

if (isWeb) hydrateMem();

// ---- Native SQLite setup ---------------------------------------------------

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("muksmusic.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT,
          durationMs INTEGER,
          artworkUrl TEXT,
          localAudioPath TEXT NOT NULL,
          localArtPath TEXT,
          liked INTEGER NOT NULL DEFAULT 0,
          addedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS playlist_tracks (
          playlistId TEXT NOT NULL,
          trackId TEXT NOT NULL,
          position INTEGER NOT NULL,
          PRIMARY KEY (playlistId, trackId),
          FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

function rowToTrack(r: any): Track {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album ?? null,
    durationMs: r.durationMs ?? null,
    artworkUrl: r.artworkUrl ?? null,
    localAudioPath: r.localAudioPath,
    localArtPath: r.localArtPath ?? null,
    liked: !!r.liked,
    addedAt: r.addedAt,
  };
}

// ---- Tracks -------------------------------------------------------------

export async function insertTrack(t: Track): Promise<void> {
  if (isWeb) {
    mem.tracks = [t, ...mem.tracks.filter((x) => x.id !== t.id)];
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO tracks
       (id, title, artist, album, durationMs, artworkUrl, localAudioPath, localArtPath, liked, addedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    t.id,
    t.title,
    t.artist,
    t.album,
    t.durationMs,
    t.artworkUrl,
    t.localAudioPath,
    t.localArtPath,
    t.liked ? 1 : 0,
    t.addedAt,
  );
}

export async function getAllTracks(): Promise<Track[]> {
  if (isWeb) return [...mem.tracks].sort((a, b) => b.addedAt - a.addedAt);
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM tracks ORDER BY addedAt DESC`);
  return rows.map(rowToTrack);
}

export async function getTrack(id: string): Promise<Track | null> {
  if (isWeb) return mem.tracks.find((t) => t.id === id) ?? null;
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT * FROM tracks WHERE id = ?`, id);
  return row ? rowToTrack(row) : null;
}

export async function getDownloadedIds(): Promise<Set<string>> {
  if (isWeb) return new Set(mem.tracks.map((t) => t.id));
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM tracks`);
  return new Set(rows.map((r) => r.id));
}

export async function deleteTrack(id: string): Promise<void> {
  if (isWeb) {
    mem.tracks = mem.tracks.filter((t) => t.id !== id);
    mem.playlistTracks = mem.playlistTracks.filter((pt) => pt.trackId !== id);
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(`DELETE FROM tracks WHERE id = ?`, id);
  await db.runAsync(`DELETE FROM playlist_tracks WHERE trackId = ?`, id);
}

export async function setLiked(id: string, liked: boolean): Promise<void> {
  if (isWeb) {
    const t = mem.tracks.find((x) => x.id === id);
    if (t) t.liked = liked;
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(`UPDATE tracks SET liked = ? WHERE id = ?`, liked ? 1 : 0, id);
}

export async function getLikedTracks(): Promise<Track[]> {
  if (isWeb)
    return mem.tracks.filter((t) => t.liked).sort((a, b) => b.addedAt - a.addedAt);
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM tracks WHERE liked = 1 ORDER BY addedAt DESC`,
  );
  return rows.map(rowToTrack);
}

// ---- Playlists ----------------------------------------------------------

export async function createPlaylist(name: string): Promise<Playlist> {
  const playlist: Playlist = {
    id: `pl_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    name,
    createdAt: Date.now(),
  };
  if (isWeb) {
    mem.playlists = [playlist, ...mem.playlists];
    persistMem();
    return playlist;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO playlists (id, name, createdAt) VALUES (?, ?, ?)`,
    playlist.id,
    playlist.name,
    playlist.createdAt,
  );
  return playlist;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  if (isWeb) {
    const p = mem.playlists.find((x) => x.id === id);
    if (p) p.name = name;
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(`UPDATE playlists SET name = ? WHERE id = ?`, name, id);
}

export async function deletePlaylist(id: string): Promise<void> {
  if (isWeb) {
    mem.playlists = mem.playlists.filter((p) => p.id !== id);
    mem.playlistTracks = mem.playlistTracks.filter((pt) => pt.playlistId !== id);
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(`DELETE FROM playlist_tracks WHERE playlistId = ?`, id);
  await db.runAsync(`DELETE FROM playlists WHERE id = ?`, id);
}

export async function getPlaylists(): Promise<Playlist[]> {
  if (isWeb) {
    return mem.playlists.map((p) => ({
      ...p,
      trackCount: mem.playlistTracks.filter((pt) => pt.playlistId === p.id).length,
    }));
  }
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT p.*, COUNT(pt.trackId) AS trackCount
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlistId = p.id
       GROUP BY p.id
       ORDER BY p.createdAt DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    trackCount: r.trackCount ?? 0,
  }));
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  if (isWeb) return mem.playlists.find((p) => p.id === id) ?? null;
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM playlists WHERE id = ?`, id);
  return row ? { id: row.id, name: row.name, createdAt: row.createdAt } : null;
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  if (isWeb) {
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
    persistMem();
    return;
  }
  const db = await getDb();
  const max = await db.getFirstAsync<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM playlist_tracks WHERE playlistId = ?`,
    playlistId,
  );
  const position = (max?.m ?? -1) + 1;
  await db.runAsync(
    `INSERT OR IGNORE INTO playlist_tracks (playlistId, trackId, position) VALUES (?, ?, ?)`,
    playlistId,
    trackId,
    position,
  );
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  if (isWeb) {
    mem.playlistTracks = mem.playlistTracks.filter(
      (pt) => !(pt.playlistId === playlistId && pt.trackId === trackId),
    );
    persistMem();
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM playlist_tracks WHERE playlistId = ? AND trackId = ?`,
    playlistId,
    trackId,
  );
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  if (isWeb) {
    return mem.playlistTracks
      .filter((pt) => pt.playlistId === playlistId)
      .sort((a, b) => a.position - b.position)
      .map((pt) => mem.tracks.find((t) => t.id === pt.trackId))
      .filter((t): t is Track => !!t);
  }
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT t.* FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.trackId
       WHERE pt.playlistId = ?
       ORDER BY pt.position ASC`,
    playlistId,
  );
  return rows.map(rowToTrack);
}

export { LIKED_PLAYLIST_ID };
