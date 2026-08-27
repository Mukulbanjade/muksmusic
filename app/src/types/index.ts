// Shared data shapes across the app.

/** A track as returned by the server's /search endpoint (not yet downloaded). */
export type SearchResult = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  /** Secondary artwork tried if artworkUrl fails (e.g. YouTube thumbnail). */
  fallbackArtworkUrl: string | null;
  source: "youtube";
};

/** A track that lives in the local library (audio downloaded to the phone). */
export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  /** Absolute file:// URI of the downloaded audio on this device. */
  localAudioPath: string;
  /** Absolute file:// URI of the cached cover art, if any. */
  localArtPath: string | null;
  liked: boolean;
  addedAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  /** Populated when a playlist is loaded with its tracks. */
  trackCount?: number;
};

/** Progress state for an in-flight download, keyed by track id. */
export type DownloadState = {
  id: string;
  title: string;
  artist: string;
  progress: number; // 0..1
  status: "queued" | "downloading" | "done" | "error";
  error?: string;
};
