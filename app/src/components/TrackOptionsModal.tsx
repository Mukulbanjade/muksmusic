import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Artwork } from "@/components/Artwork";
import { useLibrary } from "@/context/LibraryContext";
import { colors, spacing } from "@/theme/colors";
import type { Track } from "@/types";

type Props = {
  track: Track | null;
  onClose: () => void;
  onAddToPlaylist: (trackId: string) => void;
  /** Optional: when opened from a playlist, offer "remove from playlist". */
  onRemoveFromPlaylist?: (trackId: string) => void;
};

export function TrackOptionsModal({
  track,
  onClose,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}: Props) {
  const { toggleLike, remove } = useLibrary();

  if (!track) return null;

  function confirmDelete() {
    if (!track) return;
    Alert.alert(
      "Delete download",
      `Remove "${track.title}" from your phone? The audio file will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await remove(track);
            onClose();
          },
        },
      ],
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <Artwork
              uri={track.localArtPath}
              remoteUri={track.artworkUrl}
              seed={track.id}
              size={48}
            />
            <View style={styles.headerMeta}>
              <Text numberOfLines={1} style={styles.title}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={styles.artist}>
                {track.artist}
              </Text>
            </View>
          </View>

          <Action
            icon={track.liked ? "heart" : "heart-outline"}
            color={track.liked ? colors.accent : colors.text}
            label={track.liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
            onPress={async () => {
              await toggleLike(track);
              onClose();
            }}
          />
          <Action
            icon="add-circle-outline"
            label="Add to playlist"
            onPress={() => {
              onClose();
              onAddToPlaylist(track.id);
            }}
          />
          {onRemoveFromPlaylist && (
            <Action
              icon="remove-circle-outline"
              label="Remove from this playlist"
              onPress={() => {
                onRemoveFromPlaylist(track.id);
                onClose();
              }}
            />
          )}
          <Action
            icon="trash-outline"
            color={colors.danger}
            label="Delete download"
            onPress={confirmDelete}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({
  icon,
  label,
  color = colors.text,
  onPress,
}: {
  icon: any;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerMeta: { flex: 1, marginLeft: spacing.md },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  artist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  actionLabel: {
    fontSize: 15,
    marginLeft: spacing.lg,
    fontWeight: "500",
  },
});
