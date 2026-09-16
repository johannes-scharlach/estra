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
      <Stack.Screen name="index" options={{ title: "Household Profile" }} />
      <Stack.Screen name="[section]" />
      <Stack.Screen name="person" options={{ title: "Household person" }} />
    </Stack>
  );
}
