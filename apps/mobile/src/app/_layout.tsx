// Must be imported before anything touches a PowerSync watched query —
// those are async iterators, which Hermes does not implement natively.
import "@azure/core-asynciterator-polyfill";
// Stream primitives for the AI SDK chat client; same reason, same place.
import "../polyfills";

import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useResolveClassNames } from "uniwind";

import { SystemProvider } from "@/db/provider";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const background = useResolveClassNames("bg-background").backgroundColor;
  const foreground = useResolveClassNames("text-foreground").color;
  const border = useResolveClassNames("border-border").borderColor;
  const notification = useResolveClassNames("text-destructive").color;
  const theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: foreground ?? baseTheme.colors.primary,
      background: background ?? baseTheme.colors.background,
      card: background ?? baseTheme.colors.card,
      text: foreground ?? baseTheme.colors.text,
      border: border ?? baseTheme.colors.border,
      notification: notification ?? baseTheme.colors.notification,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SystemProvider>
          <ThemeProvider value={theme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
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
                name="meals/import"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: "fitToContents",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="meals/portions"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: "fitToContents",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="meals/move"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: "fitToContents",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              {/* pageSheet, not formSheet: the picker scrolls, and inside a
                formSheet the detent measuring pass mangles ScrollView frames
                (react-native-screens #3634). Same pattern as shop/add. */}
              <Stack.Screen
                name="meals/pick"
                options={{
                  presentation: "pageSheet",
                  headerShown: true,
                  title: "From cookbook",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen
                name="cookbook/import"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: "fitToContents",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="shop/item"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: "fitToContents",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="shop/add"
                options={{
                  presentation: "pageSheet",
                  headerShown: true,
                  title: "Add items",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              {/* The conversation: pushed from the Home entry, no tab bar.
                Back is the only chrome — history lives on Home. */}
              <Stack.Screen
                name="chats/[id]"
                options={{
                  presentation: "card",
                }}
              />
              <Stack.Screen
                name="chats/ideas"
                options={{
                  presentation: "pageSheet",
                  headerShown: true,
                  title: "Weeknight ideas",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen
                name="chats/history"
                options={{
                  presentation: "pageSheet",
                  headerShown: true,
                  title: "Chats",
                  contentStyle: { backgroundColor: "transparent" },
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
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
