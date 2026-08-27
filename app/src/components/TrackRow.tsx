import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/Artwork";
import { colors, spacing } from "@/theme/colors";
import type { Track } from "@/types";

type Props = {
  track: Track;
  isCurrent?: boolean;
  onPress: () => void;
  onMore?: () => void;
};

export function TrackRow({ track, isCurrent, onPress, onMore }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Artwork
        uri={track.localArtPath}
        remoteUri={track.artworkUrl}
        seed={track.id}
        size={48}
      />
      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={[styles.title, isCurrent && styles.titleCurrent]}
        >
          {track.title}
        </Text>
        <View style={styles.subRow}>
          {track.liked && (
            <Ionicons
              name="heart"
              size={12}
              color={colors.accent}
              style={{ marginRight: 4 }}
            />
          )}
          <Text numberOfLines={1} style={styles.artist}>
            {track.artist}
            {track.album ? ` · ${track.album}` : ""}
          </Text>
        </View>
      </View>
      {onMore && (
        <Pressable hitSlop={10} onPress={onMore} style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  titleCurrent: {
    color: colors.accent,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  artist: {
    color: colors.textMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  moreButton: {
    padding: spacing.xs,
  },
});
