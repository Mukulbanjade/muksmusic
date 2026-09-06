import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const isWeb = Platform.OS === "web";

/** Light tap — for buttons (play/pause, download, controls). */
export function tapHaptic() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Selection tick — for toggles / row selection. */
export function selectHaptic() {
  if (isWeb) return;
  Haptics.selectionAsync().catch(() => undefined);
}

/** Success notification — e.g. a finished download. */
export function successHaptic() {
  if (isWeb) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => undefined,
  );
}
