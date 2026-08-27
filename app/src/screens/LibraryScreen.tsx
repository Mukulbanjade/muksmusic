import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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
import { colors, radius, spacing } from "@/theme/colors";
import type { Playlist, Track } from "@/types";

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { tracks, playlists, likedTracks, createPlaylist } = useLibrary();
  const { playQueue, current } = usePlayer();

  const [optionsTrack, setOptionsTrack] = useState<Track | null>(null);
  const [addTrackId, setAddTrackId] = useState<string | null>(null);

  function promptCreatePlaylist() {
    // Alert.prompt is iOS-only (this is an iOS app). On any other platform,
    // fall back to a default name so the button still works.
    if (typeof Alert.prompt === "function") {
      Alert.prompt("New playlist", "Name your playlist", (name) => {
        if (name && name.trim()) createPlaylist(name.trim());
      });
    } else {
      createPlaylist(`Playlist ${playlists.length + 1}`);
    }
  }

  const header = (
    <View style={{ paddingTop: insets.top + spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Your Library</Text>
        <Pressable hitSlop={12} onPress={promptCreatePlaylist}>
          <Ionicons name="add" size={28} color={colors.text} />
        </Pressable>
      </View>

      {/* Liked Songs pinned card */}
      <Pressable
        style={styles.pinned}
        onPress={() => navigation.navigate("Liked")}
      >
        <LinearGradient colors={["#4f2fdd", "#8f7bd6"]} style={styles.pinnedArt}>
          <Ionicons name="heart" size={22} color="#fff" />
        </LinearGradient>
        <View style={{ marginLeft: spacing.md }}>
          <Text style={styles.pinnedTitle}>Liked Songs</Text>
          <Text style={styles.pinnedSub}>
            {likedTracks.length}{" "}
            {likedTracks.length === 1 ? "song" : "songs"}
          </Text>
        </View>
      </Pressable>

      {playlists.map((pl: Playlist) => (
        <Pressable
          key={pl.id}
          style={styles.plRow}
          onPress={() =>
            navigation.navigate("Playlist", { id: pl.id, name: pl.name })
          }
        >
          <View style={styles.plArt}>
            <Ionicons name="musical-notes" size={22} color={colors.textMuted} />
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.plTitle} numberOfLines={1}>
              {pl.name}
            </Text>
            <Text style={styles.plSub}>
              Playlist · {pl.trackCount ?? 0}{" "}
              {(pl.trackCount ?? 0) === 1 ? "song" : "songs"}
            </Text>
          </View>
        </Pressable>
      ))}

      {tracks.length > 0 && <Text style={styles.songsHeader}>Songs</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            isCurrent={current?.id === item.id}
            onPress={() => playQueue(tracks, index)}
            onMore={() => setOptionsTrack(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 160 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No downloaded songs yet. Search to add some.
          </Text>
        }
      />

      <TrackOptionsModal
        track={optionsTrack}
        onClose={() => setOptionsTrack(null)}
        onAddToPlaylist={(id) => setAddTrackId(id)}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: { color: colors.text, fontSize: 26, fontWeight: "800" },
  pinned: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pinnedArt: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  pinnedSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  plRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  plArt: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  plTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  plSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  songsHeader: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textFaint,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
});
