// A Spotify-inspired dark palette. Kept in one place so screens stay consistent.
export const colors = {
  bg: "#000000",
  bgElevated: "#121212",
  surface: "#181818",
  surfaceHighlight: "#282828",
  border: "#2a2a2a",

  text: "#ffffff",
  textMuted: "#b3b3b3",
  textFaint: "#727272",

  accent: "#1db954", // Spotify green
  accentPressed: "#1ed760",
  danger: "#e22134",

  // Used for gradient headers / placeholder artwork
  gradientTop: "#3b3b3b",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

// Deterministic pleasant gradient for placeholder artwork, seeded by a string.
export function gradientForSeed(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue}, 42%, 32%)`, `hsl(${(hue + 40) % 360}, 30%, 12%)`];
}
