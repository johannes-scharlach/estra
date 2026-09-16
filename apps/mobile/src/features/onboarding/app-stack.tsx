import { Stack } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { Alert } from "react-native";
import { useHouseholdAccess } from "./access";
import { useOnboarding } from "./provider";

export function AppStack({ children }: { children: ReactNode }) {
  const access = useHouseholdAccess();
  const { draft, ready, clear } = useOnboarding();
  useEffect(() => {
    if (!ready || !access.complete || !draft) return;
    // This also handles a process closing between the local commit and cleanup.
    if (draft.list_id !== access.listId)
      Alert.alert(
        "Welcome back",
        "Your existing household setup has been loaded.",
      );
    void clear().catch(() => {});
  }, [ready, access.complete, access.listId, draft, clear]);
  return (
    <Stack>
      <Stack.Protected guard={access.complete}>{children}</Stack.Protected>
      <Stack.Protected guard={!access.complete}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
