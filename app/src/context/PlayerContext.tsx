import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Track } from "@/types";

export type RepeatMode = "off" | "all" | "one";

type PlayerContextValue = {
  current: Track | null;
  queue: Track[];
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffle: boolean;

  playQueue: (tracks: Track[], startIndex: number) => void;
  playTrack: (track: Track) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (ms: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef<number>(-1);
  const repeatRef = useRef<RepeatMode>("off");
  const shuffleRef = useRef<boolean>(false);

  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);

  // Configure audio for silent-switch + background playback once.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    }).catch(() => undefined);
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const ensurePlayer = useCallback((uri: string): AudioPlayer => {
    if (!playerRef.current) {
      const p = createAudioPlayer({ uri }, { updateInterval: 500 });
      p.addListener("playbackStatusUpdate", (status: any) => {
        if (typeof status.currentTime === "number") {
          setPositionMs(Math.round(status.currentTime * 1000));
        }
        if (typeof status.duration === "number" && status.duration > 0) {
          setDurationMs(Math.round(status.duration * 1000));
        }
        if (typeof status.playing === "boolean") {
          setIsPlaying(status.playing);
        }
        if (status.didJustFinish) {
          handleTrackEnd();
        }
      });
      playerRef.current = p;
    }
    return playerRef.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadIndex = useCallback(
    (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) return;
      const track = q[index];
      indexRef.current = index;
      setCurrent(track);
      setPositionMs(0);
      setDurationMs(track.durationMs ?? 0);

      const player = ensurePlayer(track.localAudioPath);
      player.replace({ uri: track.localAudioPath });
      player.play();
      setIsPlaying(true);
    },
    [ensurePlayer],
  );

  const handleTrackEnd = useCallback(() => {
    const mode = repeatRef.current;
    if (mode === "one") {
      loadIndex(indexRef.current);
      return;
    }
    const q = queueRef.current;
    let nextIndex = indexRef.current + 1;
    if (shuffleRef.current && q.length > 1) {
      nextIndex = Math.floor(Math.random() * q.length);
    }
    if (nextIndex >= q.length) {
      if (mode === "all") nextIndex = 0;
      else {
        setIsPlaying(false);
        return;
      }
    }
    loadIndex(nextIndex);
  }, [loadIndex]);

  const playQueue = useCallback(
    (tracks: Track[], startIndex: number) => {
      if (tracks.length === 0) return;
      queueRef.current = tracks;
      setQueue(tracks);
      loadIndex(Math.max(0, Math.min(startIndex, tracks.length - 1)));
    },
    [loadIndex],
  );

  const playTrack = useCallback(
    (track: Track) => {
      playQueue([track], 0);
    },
    [playQueue],
  );

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const next = useCallback(() => {
    const q = queueRef.current;
    let nextIndex = indexRef.current + 1;
    if (shuffleRef.current && q.length > 1) {
      nextIndex = Math.floor(Math.random() * q.length);
    }
    if (nextIndex >= q.length) nextIndex = 0;
    loadIndex(nextIndex);
  }, [loadIndex]);

  const previous = useCallback(() => {
    // Restart the track if we're more than 3s in; otherwise go back one.
    if (positionMs > 3000) {
      playerRef.current?.seekTo(0);
      setPositionMs(0);
      return;
    }
    const prevIndex = indexRef.current - 1;
    if (prevIndex < 0) {
      playerRef.current?.seekTo(0);
      setPositionMs(0);
      return;
    }
    loadIndex(prevIndex);
  }, [positionMs, loadIndex]);

  const seekTo = useCallback((ms: number) => {
    playerRef.current?.seekTo(ms / 1000);
    setPositionMs(ms);
  }, []);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["off", "all", "one"];
    const nextMode = order[(order.indexOf(repeatRef.current) + 1) % order.length];
    repeatRef.current = nextMode;
    setRepeat(nextMode);
  }, []);

  const toggleShuffle = useCallback(() => {
    shuffleRef.current = !shuffleRef.current;
    setShuffle(shuffleRef.current);
  }, []);

  const value: PlayerContextValue = useMemo(
    () => ({
      current,
      queue,
      isPlaying,
      positionMs,
      durationMs,
      repeat,
      shuffle,
      playQueue,
      playTrack,
      toggle,
      next,
      previous,
      seekTo,
      cycleRepeat,
      toggleShuffle,
    }),
    [
      current,
      queue,
      isPlaying,
      positionMs,
      durationMs,
      repeat,
      shuffle,
      playQueue,
      playTrack,
      toggle,
      next,
      previous,
      seekTo,
      cycleRepeat,
      toggleShuffle,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
