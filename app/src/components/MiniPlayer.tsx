import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/Artwork";
import { usePlayer } from "@/context/PlayerContext";
import { colors, spacing } from "@/theme/colors";

export function MiniPlayer() {
  const { current, isPlaying, toggle, next, positionMs, durationMs } = usePlayer();
  const navigation = useNavigation<any>();

  if (!current) return null;

  const progress =
    durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.bar}
        onPress={() => navigation.navigate("NowPlaying")}
      >
        <Artwork
          uri={current.localArtPath}
          remoteUri={current.artworkUrl}
          seed={current.id}
          size={40}
        />
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>
            {current.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {current.artist}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={toggle} style={styles.control}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={26}
            color={colors.text}
          />
        </Pressable>
        <Pressable hitSlop={12} onPress={next} style={styles.control}>
          <Ionicons name="play-skip-forward" size={22} color={colors.text} />
        </Pressable>
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.sm,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceHighlight,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  control: {
    paddingHorizontal: spacing.sm,
  },
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: spacing.sm,
    marginBottom: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
});
