import { Stack } from "expo-router";
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
      <Stack.Screen name="[step]" />
      <Stack.Screen name="person" options={{ title: "Household person" }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
    </Stack>
  );
}
