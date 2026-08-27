import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { checkHealth, getServerUrl, setServerUrl } from "@/api/server";
import { useLibrary } from "@/context/LibraryContext";
import { getStorageUsage } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { colors, radius, spacing } from "@/theme/colors";

type Status = "idle" | "checking" | "ok" | "fail";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { tracks, playlists } = useLibrary();

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [ytDlp, setYtDlp] = useState<string | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    getServerUrl().then(setUrl);
    getStorageUsage().then(setUsage).catch(() => setUsage(0));
  }, [tracks.length]);

  async function saveAndTest() {
    setStatus("checking");
    setYtDlp(null);
    await setServerUrl(url);
    const res = await checkHealth(url);
    setStatus(res.ok ? "ok" : "fail");
    setYtDlp(res.ytDlp);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 160 }}
    >
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.sectionTitle}>Server</Text>
      <Text style={styles.help}>
        muksmusic searches and downloads through your muksmusic server. Enter its
        address here — your hosted URL, or your Mac's LAN IP + :8787 for local use.
      </Text>

      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://your-server.fly.dev"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />

      <Pressable style={styles.button} onPress={saveAndTest}>
        {status === "checking" ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Save & test connection</Text>
        )}
      </Pressable>

      {status === "ok" && (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={styles.statusOk}>
            Connected{ytDlp ? ` · yt-dlp ${ytDlp}` : ""}
          </Text>
        </View>
      )}
      {status === "fail" && (
        <View style={styles.statusRow}>
          <Ionicons name="close-circle" size={18} color={colors.danger} />
          <Text style={styles.statusFail}>
            Couldn't reach the server. Check the URL and that it's running.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Storage</Text>
      <View style={styles.statCard}>
        <Stat label="Songs" value={String(tracks.length)} />
        <Stat label="Playlists" value={String(playlists.length)} />
        <Stat
          label="On device"
          value={usage != null ? formatBytes(usage) : "…"}
        />
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.help}>
        Every song you download is stored on this phone, so your library plays
        fully offline.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  headerLabel: { color: colors.text, fontSize: 17, fontWeight: "700" },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  help: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonText: { color: "#000", fontWeight: "800", fontSize: 15 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statusOk: { color: colors.accent, marginLeft: spacing.sm, flex: 1 },
  statusFail: { color: colors.textMuted, marginLeft: spacing.sm, flex: 1, lineHeight: 18 },
  statCard: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
