import { Ionicons } from "@expo/vector-icons";
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniPlayer } from "@/components/MiniPlayer";
import { colors } from "@/theme/colors";
import { HomeScreen } from "@/screens/HomeScreen";
import { LibraryScreen } from "@/screens/LibraryScreen";
import { NowPlayingScreen } from "@/screens/NowPlayingScreen";
import { PlaylistDetailScreen } from "@/screens/PlaylistDetailScreen";
import { SearchScreen } from "@/screens/SearchScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  HomeTab: ["home", "home-outline"],
  SearchTab: ["search", "search-outline"],
  LibraryTab: ["library", "library-outline"],
};

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = TAB_ICONS[route.name] ?? [
              "ellipse",
              "ellipse-outline",
            ];
            return (
              <Ionicons
                name={focused ? active : inactive}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{ title: "Home" }}
        />
        <Tab.Screen
          name="SearchTab"
          component={SearchScreen}
          options={{ title: "Search" }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{ title: "Library" }}
        />
      </Tab.Navigator>

      {/* Floating mini player sits just above the tab bar. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: (insets.bottom || 8) + 50,
        }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Playlist" component={PlaylistDetailScreen} />
      <Stack.Screen name="Liked" component={PlaylistDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="NowPlaying"
        component={NowPlayingScreen}
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}
