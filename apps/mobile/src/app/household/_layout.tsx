import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";

export default function HouseholdLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        animation: reduced ? "fade" : "default",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      {/* The header lives on the root stack's "household" screen: only there
          does the system back chevron have somewhere to go. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="invite" options={{ title: "Invite to household" }} />
      <Stack.Screen
        name="[section]"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="switch"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="person"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
