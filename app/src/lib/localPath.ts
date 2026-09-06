import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Resolve a stored local media path to a currently-valid absolute file URI.
 *
 * iOS changes the app's data-container UUID on some reinstalls, which makes the
 * absolute paths we saved earlier point at nothing. We store the tail of the
 * path (e.g. ".../Documents/audio/x.m4a") and re-anchor it to the CURRENT
 * documentDirectory here, so a library survives app updates. Also accepts
 * relative paths ("audio/x.m4a") and passes http(s)/web values through.
 */
export function resolveLocal(stored: string | null | undefined): string {
  if (!stored) return "";
  if (Platform.OS === "web") return stored; // web uses remote stream URLs
  if (/^https?:\/\//.test(stored)) return stored;

  const docDir = FileSystem.documentDirectory ?? "";
  const marker = "/Documents/";
  const idx = stored.indexOf(marker);
  if (idx >= 0) return docDir + stored.slice(idx + marker.length);
  if (!stored.startsWith("file://") && !stored.startsWith("/")) {
    return docDir + stored; // relative → anchor to current docs dir
  }
  return stored;
}
