import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork } from "@/components/Artwork";
import { search as serverSearch } from "@/api/server";
import { useLibrary } from "@/context/LibraryContext";
import { formatDuration } from "@/lib/format";
import { colors, radius, spacing } from "@/theme/colors";
import type { SearchResult } from "@/types";

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { download, downloads, downloadedIds } = useLibrary();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await serverSearch(q);
      setResults(res);
    } catch (e: any) {
      setError(
        e?.message ??
          "Search failed. Check that the server is running and the URL in Settings is correct.",
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }: { item: SearchResult }) {
    const dl = downloads[item.id];
    const isDownloaded = downloadedIds.has(item.id);
    return (
      <View style={styles.row}>
        <Artwork
          remoteUri={item.artworkUrl}
          fallbackUri={item.fallbackArtworkUrl}
          seed={item.id}
          size={48}
        />
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {item.artist}
            {item.album
              ? ` · ${item.album}`
              : item.durationMs
                ? ` · ${formatDuration(item.durationMs)}`
                : ""}
          </Text>
        </View>
        <DownloadButton
          isDownloaded={isDownloaded}
          progress={dl?.status === "downloading" ? dl.progress : undefined}
          errored={dl?.status === "error"}
          onPress={() => download(item)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.header}>Search</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.bg} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Songs, artists…"
          placeholderTextColor="#555"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={runSearch}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={colors.bg} />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>Searching…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
          ListEmptyComponent={
            searched ? (
              <Text style={styles.hint}>No results.</Text>
            ) : (
              <View style={styles.center}>
                <Text style={styles.hint}>
                  Find any song and tap download to save it to your phone.
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

function DownloadButton({
  isDownloaded,
  progress,
  errored,
  onPress,
}: {
  isDownloaded: boolean;
  progress?: number;
  errored?: boolean;
  onPress: () => void;
}) {
  if (isDownloaded) {
    return (
      <View style={styles.dlBtn}>
        <Ionicons name="checkmark-circle" size={26} color={colors.accent} />
      </View>
    );
  }
  if (progress !== undefined) {
    return (
      <View style={styles.dlBtn}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      </View>
    );
  }
  return (
    <Pressable style={styles.dlBtn} onPress={onPress} hitSlop={8}>
      <Ionicons
        name={errored ? "alert-circle-outline" : "arrow-down-circle-outline"}
        size={26}
        color={errored ? colors.danger : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: spacing.lg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 16,
    color: "#000",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  meta: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontWeight: "500" },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  dlBtn: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  hint: {
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 20,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
