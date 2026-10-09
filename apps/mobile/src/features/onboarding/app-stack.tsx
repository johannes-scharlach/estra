import { Stack } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { Alert, Platform } from "react-native";
import {
  InvitationProvider,
  useInvitation,
} from "@/features/invitations/provider";
import { useHouseholdAccess } from "./access";
import { useOnboarding } from "./provider";
import { StartupScreen } from "./startup-screen";

export function AppStack({ children }: { children: ReactNode }) {
  return (
    <InvitationProvider>
      <InvitationStack>{children}</InvitationStack>
    </InvitationProvider>
  );
}

function InvitationStack({ children }: { children: ReactNode }) {
  const access = useHouseholdAccess();
  const invitation = useInvitation();
  const { draft, ready, clear, isPreparing } = useOnboarding();
  useEffect(() => {
    if (
      !ready ||
      !invitation.ready ||
      invitation.code ||
      !access.complete ||
      !draft ||
      isPreparing
    )
      return;
    // This also handles a process closing between the local commit and cleanup.
    if (draft.list_id !== access.listId) {
      Alert.alert(
        "Welcome back",
        "Your existing household setup has been loaded.",
      );
    }
    void clear().catch(() => {});
  }, [
    ready,
    invitation.ready,
    invitation.code,
    access.complete,
    access.listId,
    draft,
    clear,
    isPreparing,
  ]);
  const showApp = access.complete && !isPreparing;
  if (!invitation.ready) {
    return (
      <StartupScreen error={invitation.error} onRetry={invitation.retry} />
    );
  }
  return (
    // iOS draws pushed screens' headers as floating glass over the content.
    // Scrolling roots need contentInsetAdjustmentBehavior="automatic".
    <Stack
      screenOptions={
        Platform.OS === "ios"
          ? { headerTransparent: true, headerShadowVisible: false }
          : undefined
      }
    >
      <Stack.Protected guard={!!invitation.code}>
        <Stack.Screen
          name="join"
          // No header: the screen's own title changes per step
          // (You're invited / Check your inbox / Join <name>).
          options={{ headerShown: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={showApp && !invitation.code}>
        {children}
      </Stack.Protected>
      <Stack.Protected guard={!showApp && !invitation.code}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
