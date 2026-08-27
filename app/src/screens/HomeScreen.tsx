import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork } from "@/components/Artwork";
import { TrackRow } from "@/components/TrackRow";
import { useLibrary } from "@/context/LibraryContext";
import { usePlayer } from "@/context/PlayerContext";
import { colors, radius, spacing } from "@/theme/colors";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { tracks, likedTracks, playlists } = useLibrary();
  const { playQueue } = usePlayer();

  const recent = tracks.slice(0, 6);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: 160,
      }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>{greeting()}</Text>
        <Pressable
          hitSlop={12}
          onPress={() => navigation.navigate("Settings")}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Quick access grid */}
      <View style={styles.quickGrid}>
        <Pressable
          style={styles.quickTile}
          onPress={() => navigation.navigate("Liked")}
        >
          <LinearGradient
            colors={["#4f2fdd", "#8f7bd6"]}
            style={styles.quickArt}
          >
            <Ionicons name="heart" size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.quickText} numberOfLines={2}>
            Liked Songs
          </Text>
        </Pressable>

        {playlists.slice(0, 5).map((pl) => (
          <Pressable
            key={pl.id}
            style={styles.quickTile}
            onPress={() =>
              navigation.navigate("Playlist", { id: pl.id, name: pl.name })
            }
          >
            <View style={[styles.quickArt, { backgroundColor: colors.surfaceHighlight }]}>
              <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.quickText} numberOfLines={2}>
              {pl.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {recent.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recently added</Text>
          {recent.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              onPress={() => playQueue(tracks, i)}
            />
          ))}
        </>
      )}

      {tracks.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="download-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyBody}>
            Head to Search to find songs and download them to your phone.
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => navigation.navigate("SearchTab")}
          >
            <Text style={styles.emptyBtnText}>Search music</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
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
  greeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickTile: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  quickArt: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginHorizontal: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  emptyBody: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyBtnText: {
    color: "#000",
    fontWeight: "800",
  },
});
