import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as db from "@/db/database";
import { downloadTrack, removeTrackFiles } from "@/lib/download";
import type { DownloadState, Playlist, SearchResult, Track } from "@/types";

type LibraryContextValue = {
  ready: boolean;
  tracks: Track[];
  playlists: Playlist[];
  downloads: Record<string, DownloadState>;
  downloadedIds: Set<string>;
  likedTracks: Track[];

  refresh: () => Promise<void>;
  download: (result: SearchResult) => Promise<void>;
  remove: (track: Track) => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;

  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  getPlaylistTracks: (playlistId: string) => Promise<Track[]>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});

  const refresh = useCallback(async () => {
    const [allTracks, allPlaylists] = await Promise.all([
      db.getAllTracks(),
      db.getPlaylists(),
    ]);
    setTracks(allTracks);
    setPlaylists(allPlaylists);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const setDownload = useCallback((id: string, patch: Partial<DownloadState>) => {
    setDownloads((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch } as DownloadState,
    }));
  }, []);

  const download = useCallback(
    async (result: SearchResult) => {
      if (downloads[result.id]?.status === "downloading") return;
      setDownload(result.id, {
        id: result.id,
        title: result.title,
        artist: result.artist,
        progress: 0,
        status: "downloading",
      });
      try {
        await downloadTrack(result, (progress) => {
          setDownload(result.id, { progress });
        });
        setDownload(result.id, { progress: 1, status: "done" });
        await refresh();
        // Drop the finished entry after a moment so the UI settles.
        setTimeout(() => {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[result.id];
            return next;
          });
        }, 1500);
      } catch (e: any) {
        setDownload(result.id, {
          status: "error",
          error: e?.message ?? "Download failed",
        });
      }
    },
    [downloads, refresh, setDownload],
  );

  const remove = useCallback(
    async (track: Track) => {
      await removeTrackFiles(track).catch(() => undefined);
      await db.deleteTrack(track.id);
      await refresh();
    },
    [refresh],
  );

  const toggleLike = useCallback(
    async (track: Track) => {
      await db.setLiked(track.id, !track.liked);
      await refresh();
    },
    [refresh],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      const pl = await db.createPlaylist(name);
      await refresh();
      return pl;
    },
    [refresh],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await db.deletePlaylist(id);
      await refresh();
    },
    [refresh],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await db.renamePlaylist(id, name);
      await refresh();
    },
    [refresh],
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      await db.addTrackToPlaylist(playlistId, trackId);
      await refresh();
    },
    [refresh],
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      await db.removeTrackFromPlaylist(playlistId, trackId);
      await refresh();
    },
    [refresh],
  );

  const getPlaylistTracks = useCallback(
    (playlistId: string) => db.getPlaylistTracks(playlistId),
    [],
  );

  const downloadedIds = useMemo(
    () => new Set(tracks.map((t) => t.id)),
    [tracks],
  );
  const likedTracks = useMemo(() => tracks.filter((t) => t.liked), [tracks]);

  const value: LibraryContextValue = {
    ready,
    tracks,
    playlists,
    downloads,
    downloadedIds,
    likedTracks,
    refresh,
    download,
    remove,
    toggleLike,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    getPlaylistTracks,
  };

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
