// Must be imported before anything touches a PowerSync watched query —
// those are async iterators, which Hermes does not implement natively.
import "@azure/core-asynciterator-polyfill";

import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SystemProvider } from "@/db/provider";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SystemProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* No variant/_layout.tsx by design: [id] must sit above (tabs)
                in this same stack to get the system back button + swipe-back.
                Push-time chrome for its sub-screens is declared here. */}
            <Stack.Screen
              name="variant/plan"
              options={{
                presentation: "formSheet",
                sheetAllowedDetents: "fitToContents",
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="variant/cook"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "fade_from_bottom",
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SystemProvider>
    </GestureHandlerRootView>
  );
}
