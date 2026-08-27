import {
  DarkTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LibraryProvider } from "@/context/LibraryContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { ensureDirs } from "@/lib/download";
import { RootNavigator } from "@/navigation/RootNavigator";
import { colors } from "@/theme/colors";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

export default function App() {
  useEffect(() => {
    ensureDirs().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LibraryProvider>
          <PlayerProvider>
            <View style={styles.root}>
              <StatusBar style="light" />
              <NavigationContainer theme={navTheme}>
                <RootNavigator />
              </NavigationContainer>
            </View>
          </PlayerProvider>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
