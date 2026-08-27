import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Artwork } from "@/components/Artwork";
import { useLibrary } from "@/context/LibraryContext";
import { usePlayer } from "@/context/PlayerContext";
import { formatDuration } from "@/lib/format";
import { colors, gradientForSeed, spacing } from "@/theme/colors";

export function NowPlayingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    current,
    isPlaying,
    positionMs,
    durationMs,
    repeat,
    shuffle,
    toggle,
    next,
    previous,
    seekTo,
    cycleRepeat,
    toggleShuffle,
  } = usePlayer();
  const { tracks, toggleLike } = useLibrary();

  const [scrubbing, setScrubbing] = useState<number | null>(null);

  if (!current) {
    navigation.goBack();
    return null;
  }

  // Reflect the freshest liked state from the library.
  const liveTrack = tracks.find((t) => t.id === current.id) ?? current;
  const [from] = gradientForSeed(current.id);
  const displayMs = scrubbing ?? positionMs;
  const max = durationMs > 0 ? durationMs : current.durationMs ?? 1;

  return (
    <LinearGradient colors={[from, colors.bg, colors.bg]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Now Playing</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.artWrap}>
        <Artwork
          uri={current.localArtPath}
          remoteUri={current.artworkUrl}
          seed={current.id}
          size={320}
          rounded={12}
        />
      </View>

      <View style={styles.metaRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {current.artist}
            {current.album ? ` · ${current.album}` : ""}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={() => toggleLike(liveTrack)}>
          <Ionicons
            name={liveTrack.liked ? "heart" : "heart-outline"}
            size={28}
            color={liveTrack.liked ? colors.accent : colors.text}
          />
        </Pressable>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={max}
        value={displayMs}
        minimumTrackTintColor={colors.text}
        maximumTrackTintColor="rgba(255,255,255,0.3)"
        thumbTintColor={colors.text}
        onValueChange={(v) => setScrubbing(v)}
        onSlidingComplete={(v) => {
          seekTo(v);
          setScrubbing(null);
        }}
      />
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatDuration(displayMs)}</Text>
        <Text style={styles.time}>{formatDuration(max)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable hitSlop={10} onPress={toggleShuffle}>
          <Ionicons
            name="shuffle"
            size={26}
            color={shuffle ? colors.accent : colors.textMuted}
          />
        </Pressable>
        <Pressable hitSlop={10} onPress={previous}>
          <Ionicons name="play-skip-back" size={36} color={colors.text} />
        </Pressable>
        <Pressable style={styles.playBtn} onPress={toggle}>
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={36}
            color="#000"
          />
        </Pressable>
        <Pressable hitSlop={10} onPress={next}>
          <Ionicons name="play-skip-forward" size={36} color={colors.text} />
        </Pressable>
        <Pressable hitSlop={10} onPress={cycleRepeat}>
          <Ionicons
            name={repeat === "one" ? "repeat" : "repeat"}
            size={26}
            color={repeat === "off" ? colors.textMuted : colors.accent}
          />
          {repeat === "one" && <View style={styles.repeatDot} />}
        </Pressable>
      </View>
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
  artWrap: {
    alignItems: "center",
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  artist: { color: colors.textMuted, fontSize: 16, marginTop: 4 },
  slider: {
    width: "100%",
    height: 40,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.sm,
  },
  time: { color: colors.textMuted, fontSize: 12 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatDot: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
