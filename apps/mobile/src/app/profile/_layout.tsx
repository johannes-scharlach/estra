import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";

export default function ProfileLayout() {
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
        options={{ title: "Household Profile", presentation: "pageSheet" }}
      />
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
