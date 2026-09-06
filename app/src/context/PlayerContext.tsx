import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { resolveLocal } from "@/lib/localPath";
import type { Track } from "@/types";

export type RepeatMode = "off" | "all" | "one";

const CROSSFADE_KEY = "muksmusic.crossfadeMs";

type PlayerContextValue = {
  current: Track | null;
  queue: Track[];
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffle: boolean;
  crossfadeMs: number;

  playQueue: (tracks: Track[], startIndex: number) => void;
  playTrack: (track: Track) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (ms: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setCrossfadeMs: (ms: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // Two players so one track can fade out while the next fades in.
  const playersRef = useRef<(AudioPlayer | null)[]>([null, null]);
  const activeRef = useRef(0);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>("off");
  const shuffleRef = useRef(false);
  const crossfadeMsRef = useRef(0);
  const fadingRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [crossfadeMs, setCrossfadeMsState] = useState(0);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    }).catch(() => undefined);
    AsyncStorage.getItem(CROSSFADE_KEY)
      .then((v) => {
        const ms = v ? parseInt(v, 10) : 0;
        if (!Number.isNaN(ms)) {
          crossfadeMsRef.current = ms;
          setCrossfadeMsState(ms);
        }
      })
      .catch(() => undefined);
    return () => {
      clearFade();
      playersRef.current.forEach((p) => p?.remove());
      playersRef.current = [null, null];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Create (once) the player for slot i, wiring its status listener.
  const getPlayer = useCallback((i: number, uri: string): AudioPlayer => {
    if (!playersRef.current[i]) {
      const p = createAudioPlayer({ uri }, { updateInterval: 250 });
      p.addListener("playbackStatusUpdate", (status: any) => {
        if (i !== activeRef.current) return; // only the active player drives UI
        if (typeof status.currentTime === "number") {
          setPositionMs(Math.round(status.currentTime * 1000));
        }
        if (typeof status.duration === "number" && status.duration > 0) {
          setDurationMs(Math.round(status.duration * 1000));
        }
        if (typeof status.playing === "boolean") setIsPlaying(status.playing);

        maybeCrossfade(status);
        // Ignore a "finished" that arrives in the first moment after loading
        // (some files report a spurious immediate finish).
        if (
          status.didJustFinish &&
          !fadingRef.current &&
          Date.now() - startedAtRef.current > 1500
        ) {
          handleTrackEnd();
        }
      });
      playersRef.current[i] = p;
    }
    return playersRef.current[i]!;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setVolume = (p: AudioPlayer | null, v: number) => {
    if (!p) return;
    try {
      p.volume = Math.max(0, Math.min(1, v));
    } catch {
      /* ignore */
    }
  };

  const clearFade = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    fadingRef.current = false;
  };

  /** Index of the track to play after `from`, or null if the queue should stop. */
  const nextIndexFrom = (from: number): number | null => {
    const q = queueRef.current;
    if (repeatRef.current === "one") return from;
    if (shuffleRef.current && q.length > 1) {
      let n = from;
      while (n === from) n = Math.floor(Math.random() * q.length);
      return n;
    }
    const n = from + 1;
    if (n >= q.length) return repeatRef.current === "all" ? 0 : null;
    return n;
  };

  const loadInto = (slot: number, index: number, autoplay = true) => {
    const q = queueRef.current;
    const track = q[index];
    if (!track) return;
    const uri = resolveLocal(track.localAudioPath);
    const p = getPlayer(slot, uri);
    setVolume(p, 1);
    p.replace({ uri });
    if (autoplay) p.play();
  };

  const loadIndex = useCallback((index: number) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    clearFade();
    // Stop the other player if it was mid-fade.
    const other = playersRef.current[1 - activeRef.current];
    try {
      other?.pause();
    } catch {
      /* ignore */
    }
    indexRef.current = index;
    startedAtRef.current = Date.now();
    setCurrent(q[index]);
    setPositionMs(0);
    setDurationMs(q[index].durationMs ?? 0);
    loadInto(activeRef.current, index, true);
    setIsPlaying(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called on every status tick of the active player.
  function maybeCrossfade(status: any) {
    const xf = crossfadeMsRef.current;
    if (xf <= 0 || fadingRef.current) return;
    if (status.playing === false) return; // never crossfade while paused
    const dur = status.duration;
    const cur = status.currentTime;
    if (typeof dur !== "number" || dur <= 0 || typeof cur !== "number") return;
    const xfSec = xf / 1000;
    // Only for tracks comfortably longer than the fade, and only once we're
    // genuinely past the halfway mark — guards against wrong-duration files.
    if (dur < xfSec + 8) return;
    if (cur < dur / 2) return;
    if (dur - cur > xfSec) return; // not near the end yet

    const target = nextIndexFrom(indexRef.current);
    if (target == null || target === indexRef.current) return; // nothing to fade to

    // Begin crossfade into the inactive slot.
    fadingRef.current = true;
    const fromSlot = activeRef.current;
    const toSlot = 1 - fromSlot;
    const fromPlayer = playersRef.current[fromSlot];
    loadInto(toSlot, target, true);
    const toPlayer = playersRef.current[toSlot];
    setVolume(toPlayer, 0);

    // Hand the UI over to the incoming track immediately.
    activeRef.current = toSlot;
    indexRef.current = target;
    startedAtRef.current = Date.now();
    setCurrent(queueRef.current[target]);
    setDurationMs(queueRef.current[target].durationMs ?? 0);

    const steps = Math.max(1, Math.round(xf / 50));
    let step = 0;
    fadeTimerRef.current = setInterval(() => {
      step++;
      const t = step / steps;
      setVolume(fromPlayer, 1 - t);
      setVolume(toPlayer, t);
      if (step >= steps) {
        try {
          fromPlayer?.pause();
        } catch {
          /* ignore */
        }
        setVolume(fromPlayer, 1);
        clearFade();
      }
    }, 50);
  }

  const handleTrackEnd = useCallback(() => {
    const target = nextIndexFrom(indexRef.current);
    if (target == null) {
      setIsPlaying(false);
      return;
    }
    loadIndex(target);
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
    (track: Track) => playQueue([track], 0),
    [playQueue],
  );

  const toggle = useCallback(() => {
    const p = playersRef.current[activeRef.current];
    if (!p) return;
    // Use the player's actual state, not React state, to avoid stale toggles.
    const playing = (p as any).playing ?? isPlaying;
    if (playing) {
      p.pause();
      setIsPlaying(false);
    } else {
      p.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const next = useCallback(() => {
    const target = nextIndexFrom(indexRef.current);
    loadIndex(target ?? 0);
  }, [loadIndex]);

  const previous = useCallback(() => {
    const p = playersRef.current[activeRef.current];
    if (positionMs > 3000 || indexRef.current <= 0) {
      p?.seekTo(0);
      setPositionMs(0);
      return;
    }
    loadIndex(indexRef.current - 1);
  }, [positionMs, loadIndex]);

  const seekTo = useCallback((ms: number) => {
    playersRef.current[activeRef.current]?.seekTo(ms / 1000);
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

  const setCrossfadeMs = useCallback((ms: number) => {
    crossfadeMsRef.current = ms;
    setCrossfadeMsState(ms);
    AsyncStorage.setItem(CROSSFADE_KEY, String(ms)).catch(() => undefined);
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
      crossfadeMs,
      playQueue,
      playTrack,
      toggle,
      next,
      previous,
      seekTo,
      cycleRepeat,
      toggleShuffle,
      setCrossfadeMs,
    }),
    [
      current,
      queue,
      isPlaying,
      positionMs,
      durationMs,
      repeat,
      shuffle,
      crossfadeMs,
      playQueue,
      playTrack,
      toggle,
      next,
      previous,
      seekTo,
      cycleRepeat,
      toggleShuffle,
      setCrossfadeMs,
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
