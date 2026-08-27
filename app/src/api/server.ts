import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SearchResult } from "@/types";

const SERVER_URL_KEY = "muksmusic.serverUrl";
// Set this to your hosted server (e.g. a Fly.io/Render URL) so the app works
// without your Mac. Overridable in the app's Settings screen.
const DEFAULT_SERVER_URL = "https://muksmusic-server.fly.dev";

let cachedUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (cachedUrl != null) return cachedUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  cachedUrl = stored ?? DEFAULT_SERVER_URL;
  return cachedUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, "");
  cachedUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_KEY, clean);
}

export function getDefaultServerUrl(): string {
  return DEFAULT_SERVER_URL;
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
