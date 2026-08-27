import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { buildArtUrl, buildDownloadUrl } from "@/api/server";
import { insertTrack } from "@/db/database";
import type { SearchResult, Track } from "@/types";

const isWeb = Platform.OS === "web";
const AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;
const ART_DIR = `${FileSystem.documentDirectory}art/`;

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function ensureDirs(): Promise<void> {
  if (isWeb) return; // no local filesystem in the browser preview
  await ensureDir(AUDIO_DIR);
  await ensureDir(ART_DIR);
}

function audioPathFor(id: string): string {
  return `${AUDIO_DIR}${id}.m4a`;
}

function artPathFor(id: string): string {
  return `${ART_DIR}${id}.jpg`;
}

/**
 * Download a search result's audio (and cover art) onto the device and record
 * it in the library. `onProgress` is called with 0..1 as the audio streams in.
 */
export async function downloadTrack(
  result: SearchResult,
  onProgress?: (progress: number) => void,
): Promise<Track> {
  await ensureDirs();

  const audioUrl = await buildDownloadUrl(result.id);

  // Browser preview: there's no local filesystem, so "download" just points the
  // track at the live stream URL. expo-audio plays http(s) URLs on web.
  if (isWeb) {
    onProgress?.(1);
    const track: Track = {
      id: result.id,
      title: result.title,
      artist: result.artist,
      album: result.album,
      durationMs: result.durationMs,
      artworkUrl: result.artworkUrl,
      localAudioPath: audioUrl,
      localArtPath: null,
      liked: false,
      addedAt: Date.now(),
    };
    await insertTrack(track);
    return track;
  }

  const audioPath = audioPathFor(result.id);

  const resumable = FileSystem.createDownloadResumable(
    audioUrl,
    audioPath,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    },
  );

  const audioResult = await resumable.downloadAsync();
  if (!audioResult || audioResult.status !== 200) {
    // Clean up a partial/failed file so the library never points at junk.
    await FileSystem.deleteAsync(audioPath, { idempotent: true });
    throw new Error(`Download failed (status ${audioResult?.status ?? "?"})`);
  }

  // Best-effort artwork download; a missing cover shouldn't fail the track.
  // Try the album cover first, then the fallback (YouTube thumbnail), via the
  // server's art proxy.
  let localArtPath: string | null = null;
  const artDest = artPathFor(result.id);
  for (const remote of [result.artworkUrl, result.fallbackArtworkUrl]) {
    if (!remote) continue;
    try {
      const artUrl = await buildArtUrl(remote);
      const artResult = await FileSystem.downloadAsync(artUrl, artDest);
      if (artResult.status === 200) {
        localArtPath = artDest;
        break;
      }
    } catch {
      /* try the next source */
    }
  }

  const track: Track = {
    id: result.id,
    title: result.title,
    artist: result.artist,
    album: result.album,
    durationMs: result.durationMs,
    artworkUrl: result.artworkUrl,
    localAudioPath: audioPath,
    localArtPath,
    liked: false,
    addedAt: Date.now(),
  };

  await insertTrack(track);
  return track;
}

/** Remove the on-disk audio and art files for a track. */
export async function removeTrackFiles(track: Track): Promise<void> {
  if (isWeb) return; // nothing on disk in the browser preview
  await FileSystem.deleteAsync(track.localAudioPath, { idempotent: true });
  if (track.localArtPath) {
    await FileSystem.deleteAsync(track.localArtPath, { idempotent: true });
  }
}

/** Total bytes used by downloaded audio + art. */
export async function getStorageUsage(): Promise<number> {
  if (isWeb) return 0;
  let total = 0;
  for (const dir of [AUDIO_DIR, ART_DIR]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) continue;
    const files = await FileSystem.readDirectoryAsync(dir);
    for (const f of files) {
      const fi = await FileSystem.getInfoAsync(`${dir}${f}`);
      if (fi.exists && !fi.isDirectory && typeof fi.size === "number") {
        total += fi.size;
      }
    }
  }
  return total;
}
