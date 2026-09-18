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
        options={{ title: "Household Profile", presentation: "formSheet" }}
      />
      <Stack.Screen name="[section]" options={{ presentation: "formSheet" }} />
      <Stack.Screen
        name="person"
        options={{ title: "Household person", presentation: "formSheet" }}
      />
    </Stack>
  );
}
