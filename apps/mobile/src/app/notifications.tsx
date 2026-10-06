import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { Action, PrimaryAction } from "@/components/action";
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
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not enable notifications.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!state) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="items-center justify-center px-6 py-12"
      >
        <ActivityIndicator />
      </ScrollView>
    );
  }
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-6 pt-4"
    >
      <View className="gap-3">
        <Text className="text-lg leading-7 text-muted-foreground">
          Get a notification when someone joins your household.
        </Text>
        {state === "enabled" ? (
          <Text className="text-muted-foreground">
            Notifications are on. To turn them off, use the notification
            settings on this device.
          </Text>
        ) : null}
        {state === "disabled" ? (
          <Text className="text-muted-foreground">
            Notifications are off in system settings. You can turn them on
            there.
          </Text>
        ) : null}
      </View>
      <FormError message={error} />
      <View className="gap-3">
        {state === "enabled" ? (
          <>
            <PrimaryAction label="Done" onPress={() => router.back()} />
            <Action
              label="Turn off"
              onPress={() => void openNotificationSettings()}
            />
          </>
        ) : (
          <>
            <PrimaryAction
              disabled={busy}
              label={
                busy
                  ? "Enabling…"
                  : state === "disabled"
                    ? "Open settings"
                    : "Allow notifications"
              }
              onPress={() => void allow()}
            />
            <Action
              label={prompted ? "Not now" : "Cancel"}
              onPress={() => void finish()}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
