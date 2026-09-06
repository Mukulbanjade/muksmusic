import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/context/PlayerContext";
import { tapHaptic } from "@/lib/haptics";
import { activeLineIndex, getLyrics, type Lyrics } from "@/lib/lyrics";
import { colors, gradientForSeed, spacing } from "@/theme/colors";

export function LyricsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { current, positionMs, seekTo } = usePlayer();

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const lineYs = useRef<number[]>([]);
  const lastScrolledLine = useRef(-1);

  useEffect(() => {
    let active = true;
    if (!current) return;
    setLoading(true);
    setLyrics(null);
    getLyrics(current)
      .then((l) => active && setLyrics(l))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [current?.id]);

  const synced = lyrics?.synced ?? null;
  const activeIdx = synced ? activeLineIndex(synced, positionMs) : -1;

  // Auto-scroll to keep the active line centered.
  useEffect(() => {
    if (activeIdx < 0 || activeIdx === lastScrolledLine.current) return;
    const y = lineYs.current[activeIdx];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 220), animated: true });
      lastScrolledLine.current = activeIdx;
    }
  }, [activeIdx]);

  const [from] = gradientForSeed(current?.id ?? "lyrics");

  return (
    <LinearGradient colors={[from, colors.bg, colors.bg]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Lyrics</Text>
        <View style={{ width: 30 }} />
      </View>

      {current && (
        <View style={styles.trackHead}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {current.artist}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>Finding lyrics…</Text>
        </View>
      ) : !lyrics ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes-outline" size={44} color={colors.textFaint} />
          <Text style={styles.hint}>No lyrics found for this song.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 240 }}
          showsVerticalScrollIndicator={false}
        >
          {synced ? (
            synced.map((line, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  tapHaptic();
                  seekTo(line.timeMs);
                }}
                onLayout={(e) => (lineYs.current[i] = e.nativeEvent.layout.y)}
              >
                <Text
                  style={[
                    styles.line,
                    i === activeIdx && styles.lineActive,
                    i < activeIdx && styles.linePast,
                  ]}
                >
                  {line.text || "♪"}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.plain}>{lyrics.plain}</Text>
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  headerLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  trackHead: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  trackTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  trackArtist: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  hint: {
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  line: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 34,
    marginVertical: spacing.sm,
  },
  lineActive: {
    color: colors.text,
  },
  linePast: {
    color: "rgba(255,255,255,0.35)",
  },
  plain: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 28,
  },
});
