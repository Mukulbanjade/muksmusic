// Tempo (BPM) analysis for downloaded tracks, for the app's Mix feature.
// Decodes the audio with ffmpeg and pipes raw mono PCM into `bpm` (bpm-tools).
// Results are cached in a sidecar JSON so we only analyze each track once.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function cachePath(libraryDir) {
  return join(libraryDir, "bpm-cache.json");
}

function loadCache(libraryDir) {
  try {
    return JSON.parse(readFileSync(cachePath(libraryDir), "utf8"));
  } catch {
    return {};
  }
}

function saveCache(libraryDir, cache) {
  try {
    writeFileSync(cachePath(libraryDir), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

/** Run `ffmpeg <file> | bpm` and resolve a numeric BPM (or null). */
function detectBpm(filePath) {
  return new Promise((resolve) => {
    const ff = spawn("ffmpeg", [
      "-v", "quiet",
      "-i", filePath,
      "-ac", "1",
      "-ar", "44100",
      "-f", "f32le",
      "-",
    ]);
    const bpm = spawn("bpm");
    let out = "";
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      try { ff.kill(); } catch {}
      try { bpm.kill(); } catch {}
      resolve(val);
    };

    ff.on("error", () => done(null));
    bpm.on("error", () => done(null));
    ff.stdout.pipe(bpm.stdin);
    // Ignore EPIPE if bpm exits before ffmpeg finishes.
    ff.stdout.on("error", () => {});
    bpm.stdin.on("error", () => {});

    bpm.stdout.on("data", (d) => (out += d.toString()));
    bpm.on("close", () => {
      const n = parseFloat(out.trim());
      if (!Number.isFinite(n) || n <= 0) return done(null);
      // bpm-tools sometimes reports a half/double; fold into a musical range.
      let v = n;
      while (v < 70) v *= 2;
      while (v > 180) v /= 2;
      done(Math.round(v * 10) / 10);
    });

    // Safety timeout.
    setTimeout(() => done(null), 60_000);
  });
}

/** Analyze the cached file for `id` (in libraryDir), using/updating the cache. */
export async function analyzeTrack(id, libraryDir) {
  const file = join(libraryDir, `${id}.m4a`);
  if (!existsSync(file)) return { id, bpm: null, error: "not downloaded" };

  const cache = loadCache(libraryDir);
  if (typeof cache[id] === "number") return { id, bpm: cache[id] };

  const bpm = await detectBpm(file);
  if (bpm != null) {
    cache[id] = bpm;
    saveCache(libraryDir, cache);
  }
  return { id, bpm };
}
