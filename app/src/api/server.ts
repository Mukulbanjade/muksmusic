import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SearchResult } from "@/types";

const SERVER_URL_KEY = "muksmusic.serverUrl";

// Default server address. When the web build is served BY the muksmusic server
// itself, the app talks to whatever origin it was loaded from — so no config is
// ever needed. On native, point it at your server (editable in Settings).
function defaultServerUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  // Native app downloads from your home server (via the Cloudflare tunnel).
  // Editable in Settings.
  return "https://music.side-quest.cloud";
}

let cachedUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (cachedUrl != null) return cachedUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedUrl = stored ?? defaultServerUrl();
  return cachedUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, "");
  cachedUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_KEY, clean);
}

export function getDefaultServerUrl(): string {
  return defaultServerUrl();
}

export type HealthResult = {
  ok: boolean;
  ytDlp: string | null;
};

export async function checkHealth(url?: string): Promise<HealthResult> {
  const base = url ? url.trim().replace(/\/+$/, "") : await getServerUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false, ytDlp: null };
    const json = await res.json();
    return { ok: !!json.ok, ytDlp: json.ytDlp ?? null };
  } catch {
    return { ok: false, ytDlp: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function search(query: string): Promise<SearchResult[]> {
  const base = await getServerUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(
      `${base}/search?q=${encodeURIComponent(query)}&limit=20`,
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const json = await res.json();
    return Array.isArray(json.tracks) ? json.tracks : [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildDownloadUrl(id: string): Promise<string> {
  const base = await getServerUrl();
  return `${base}/download?id=${encodeURIComponent(id)}`;
}

/** Proxy artwork through the server (handles hosts the phone can't reach). */
export async function buildArtUrl(remoteUrl: string): Promise<string> {
  const base = await getServerUrl();
  return `${base}/art?url=${encodeURIComponent(remoteUrl)}`;
}
