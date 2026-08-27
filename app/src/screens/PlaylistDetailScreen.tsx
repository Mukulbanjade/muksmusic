import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { TrackOptionsModal } from "@/components/TrackOptionsModal";
import { TrackRow } from "@/components/TrackRow";
import { useLibrary } from "@/context/LibraryContext";
import { usePlayer } from "@/context/PlayerContext";
import { colors, gradientForSeed, spacing } from "@/theme/colors";
import type { Track } from "@/types";

export function PlaylistDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isLiked = route.name === "Liked";
  const playlistId: string | undefined = route.params?.id;
  const playlistName: string = isLiked
    ? "Liked Songs"
    : route.params?.name ?? "Playlist";

  const {
    tracks: allTracks,
    likedTracks,
    getPlaylistTracks,
    deletePlaylist,
    removeFromPlaylist,
  } = useLibrary();
  const { playQueue, current } = usePlayer();

  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [optionsTrack, setOptionsTrack] = useState<Track | null>(null);
  const [addTrackId, setAddTrackId] = useState<string | null>(null);

  // Reload whenever the underlying library changes (add/remove/like).
  useEffect(() => {
    let active = true;
    if (isLiked) {
      setPlaylistTracks(likedTracks);
      return;
    }
    if (playlistId) {
      getPlaylistTracks(playlistId).then((t) => {
        if (active) setPlaylistTracks(t);
      });
    }
    return () => {
      active = false;
    };
  }, [isLiked, likedTracks, playlistId, getPlaylistTracks, allTracks]);

  const [from, to] = useMemo(
    () => gradientForSeed(isLiked ? "liked-songs" : playlistId ?? "pl"),
    [isLiked, playlistId],
  );

  function confirmDeletePlaylist() {
    if (!playlistId) return;
    Alert.alert("Delete playlist", `Delete "${playlistName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePlaylist(playlistId);
          navigation.goBack();
        },
      },
    ]);
  }

  const header = (
    <LinearGradient
      colors={[from, colors.bg]}
      style={{ paddingTop: insets.top + spacing.sm }}
    >
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        {!isLiked && (
          <Pressable hitSlop={12} onPress={confirmDeletePlaylist}>
            <Ionicons name="trash-outline" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.coverWrap}>
        <LinearGradient colors={[from, to]} style={styles.cover}>
          <Ionicons
            name={isLiked ? "heart" : "musical-notes"}
            size={64}
            color="rgba(255,255,255,0.85)"
          />
        </LinearGradient>
      </View>

      <Text style={styles.playlistName}>{playlistName}</Text>
      <Text style={styles.count}>
        {playlistTracks.length}{" "}
        {playlistTracks.length === 1 ? "song" : "songs"}
      </Text>

      <View style={styles.actionsRow}>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.playBtn}
          onPress={() =>
            playlistTracks.length > 0 && playQueue(playlistTracks, 0)
          }
        >
          <Ionicons name="play" size={28} color="#000" />
        </Pressable>
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={playlistTracks}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            isCurrent={current?.id === item.id}
            onPress={() => playQueue(playlistTracks, index)}
            onMore={() => setOptionsTrack(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 160 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLiked
              ? "Tap the heart on any song to add it here."
              : "No songs yet. Use a song's menu to add it."}
          </Text>
        }
      />

      <TrackOptionsModal
        track={optionsTrack}
        onClose={() => setOptionsTrack(null)}
        onAddToPlaylist={(id) => setAddTrackId(id)}
        onRemoveFromPlaylist={
          isLiked || !playlistId
            ? undefined
            : (trackId) => removeFromPlaylist(playlistId, trackId)
        }
      />
      <AddToPlaylistModal
        visible={addTrackId !== null}
        trackId={addTrackId}
        onClose={() => setAddTrackId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    height: 44,
  },
  coverWrap: { alignItems: "center", marginVertical: spacing.lg },
  cover: {
    width: 180,
    height: 180,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
  },
  count: {
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.textFaint,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
});
