import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { FormError } from "@/features/profile/form";
import {
  enableNotifications,
  markNotificationPrompted,
  notificationState,
  openNotificationSettings,
  type NotificationState,
} from "@/features/notifications/notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { session } = useAuth();
  const [state, setState] = useState<NotificationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompted = source !== "settings";
  useEffect(() => {
    if (prompted && session) {
      void markNotificationPrompted(session.user.id);
    }
  }, [prompted, session]);
  useFocusEffect(
    useCallback(() => {
      void notificationState()
        .then(setState)
        .catch((cause) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load notification settings.",
          );
        });
    }, []),
  );
  async function finish() {
    if (session) await markNotificationPrompted(session.user.id);
    router.back();
  }
  async function allow() {
    setBusy(true);
    setError(null);
    try {
      if (state === "disabled") {
        await openNotificationSettings();
        return;
      }
      const enabled = await enableNotifications();
      setState(enabled ? "enabled" : "disabled");
      if (enabled) await finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }
  if (!state) {
    return (
      <View className="items-center justify-center px-6 py-12">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <View className="gap-6 px-6 pt-12 pb-8">
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-3xl font-bold tracking-tight">
          Household updates
        </Text>
        <Text className="text-lg leading-7 text-muted-foreground">
          Get a notification when someone joins your household.
        </Text>
        {state === "enabled" ? (
          <Text className="font-medium">Notifications are enabled.</Text>
        ) : null}
        {state === "disabled" ? (
          <Text className="text-muted-foreground">
            Notifications are off in system settings. You can turn them on there.
          </Text>
        ) : null}
      </View>
      <FormError message={error} />
      <View className="gap-3">
        {state === "enabled" ? (
          <Button onPress={() => router.back()}>
            <Text>Done</Text>
          </Button>
        ) : (
          <>
            <Button disabled={busy} onPress={() => void allow()}>
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text>
                  {state === "disabled" ? "Open settings" : "Allow notifications"}
                </Text>
              )}
            </Button>
            <Button variant="ghost" onPress={() => void finish()}>
              <Text>{prompted ? "Not now" : "Cancel"}</Text>
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
