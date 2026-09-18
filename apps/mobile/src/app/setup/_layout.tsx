import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

export default function SetupLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        animation: reduced ? "fade" : "default",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Welcome", headerShown: false }}
      />
      <Stack.Screen
        name="questions"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="person"
        options={
          Platform.OS === "ios"
            ? {
                headerShown: false,
                presentation: "formSheet",
                sheetAllowedDetents: "fitToContents",
                sheetGrabberVisible: true,
              }
            : { headerShown: false }
        }
      />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
