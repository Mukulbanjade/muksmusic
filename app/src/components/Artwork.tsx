import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";

import { gradientForSeed, radius } from "@/theme/colors";

type Props = {
  /** Preferred local file:// URI. */
  uri?: string | null;
  /** Primary remote URL (e.g. album cover). */
  remoteUri?: string | null;
  /** Secondary remote URL tried if the primary fails (e.g. YouTube thumb). */
  fallbackUri?: string | null;
  /** Seed for the placeholder gradient (e.g. track id or title). */
  seed?: string;
  size: number;
  rounded?: number;
};

export function Artwork({
  uri,
  remoteUri,
  fallbackUri,
  seed = "muks",
  size,
  rounded,
}: Props) {
  // Ordered list of sources to try before giving up on a real image.
  const sources = useMemo(
    () => [uri, remoteUri, fallbackUri].filter(Boolean) as string[],
    [uri, remoteUri, fallbackUri],
  );
  const [index, setIndex] = useState(0);

  // Reset to the first source whenever the inputs change.
  useEffect(() => setIndex(0), [sources.join("|")]);

  const borderRadius = rounded ?? radius.md;
  const current = sources[index];

  if (current) {
    return (
      <Image
        source={{ uri: current }}
        style={{ width: size, height: size, borderRadius }}
        contentFit="cover"
        transition={150}
        onError={() => setIndex((i) => i + 1)}
      />
    );
  }

  const [from, to] = gradientForSeed(seed);
  return (
    <LinearGradient
      colors={[from, to]}
      style={[styles.placeholder, { width: size, height: size, borderRadius }]}
    >
      <Ionicons name="musical-note" size={size * 0.4} color="rgba(255,255,255,0.7)" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
