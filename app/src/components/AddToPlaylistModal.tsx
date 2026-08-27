import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLibrary } from "@/context/LibraryContext";
import { colors, radius, spacing } from "@/theme/colors";

type Props = {
  visible: boolean;
  trackId: string | null;
  onClose: () => void;
};

export function AddToPlaylistModal({ visible, trackId, onClose }: Props) {
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function handleAdd(playlistId: string) {
    if (!trackId) return;
    await addToPlaylist(playlistId, trackId);
    onClose();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !trackId) return;
    const pl = await createPlaylist(trimmed);
    await addToPlaylist(pl.id, trackId);
    setName("");
    setCreating(false);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Add to playlist</Text>

          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                autoFocus
                value={name}
                onChangeText={setName}
                placeholder="Playlist name"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                onSubmitEditing={handleCreate}
              />
              <Pressable style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>Create</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.newRow} onPress={() => setCreating(true)}>
              <View style={styles.newIcon}>
                <Ionicons name="add" size={24} color={colors.text} />
              </View>
              <Text style={styles.newText}>New playlist</Text>
            </Pressable>
          )}

          <FlatList
            data={playlists}
            keyExtractor={(p) => p.id}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => handleAdd(item.id)}>
                <Ionicons
                  name="musical-notes"
                  size={20}
                  color={colors.textMuted}
                />
                <Text style={styles.rowText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.count}>{item.trackCount ?? 0}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No playlists yet.</Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
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
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHighlight,
    marginBottom: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  newIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  newText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  createBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  createBtnText: {
    color: "#000",
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    marginLeft: spacing.md,
  },
  count: {
    color: colors.textFaint,
    fontSize: 13,
  },
  empty: {
    color: colors.textFaint,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
