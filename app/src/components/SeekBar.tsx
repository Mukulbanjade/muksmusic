import React, { useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";

import { colors } from "@/theme/colors";

type Props = {
  /** Current position (ms). */
  value: number;
  /** Total duration (ms). */
  max: number;
  /** Called continuously while dragging (ms), and with null on release. */
  onScrub?: (ms: number | null) => void;
  /** Called on release with the final position (ms). */
  onSeek: (ms: number) => void;
};

/**
 * A dependency-free audio scrubber. Replaces @react-native-community/slider,
 * whose Fabric-only native code doesn't build in the old architecture.
 */
export function SeekBar({ value, max, onScrub, onSeek }: Props) {
  const widthRef = useRef(0);
  const startMsRef = useRef(0);
  const dragMsRef = useRef<number | null>(null);
  const [dragMs, setDragMs] = useState<number | null>(null);

  const clamp = (ms: number) => Math.max(0, Math.min(max || 0, ms));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const w = widthRef.current;
        const x = e.nativeEvent.locationX;
        const ms = w > 0 ? clamp((x / w) * max) : 0;
        startMsRef.current = ms;
        dragMsRef.current = ms;
        setDragMs(ms);
        onScrub?.(ms);
      },
      onPanResponderMove: (_e, gesture) => {
        const w = widthRef.current;
        if (w <= 0) return;
        const ms = clamp(startMsRef.current + (gesture.dx / w) * max);
        dragMsRef.current = ms;
        setDragMs(ms);
        onScrub?.(ms);
      },
      onPanResponderRelease: () => {
        const ms = dragMsRef.current ?? value;
        dragMsRef.current = null;
        setDragMs(null);
        onScrub?.(null);
        onSeek(ms);
      },
      onPanResponderTerminate: () => {
        dragMsRef.current = null;
        setDragMs(null);
        onScrub?.(null);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const display = dragMs ?? value;
  const pct = max > 0 ? Math.max(0, Math.min(1, display / max)) : 0;

  return (
    <View style={styles.hitArea} {...pan.panHandlers}>
      <View style={styles.track} onLayout={onLayout}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        <View style={[styles.thumb, { left: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const THUMB = 14;

const styles = StyleSheet.create({
  hitArea: {
    height: 28,
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
    marginLeft: -THUMB / 2,
  },
});
