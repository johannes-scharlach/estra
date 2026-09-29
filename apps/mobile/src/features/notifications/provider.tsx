import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  notificationState,
  registerPushDevice,
} from "./notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, ready: authReady } = useAuth();
  const { complete, households, switchHousehold } = useHouseholdAccess();
  const readyResponse = useRef<Notifications.NotificationResponse | null>(null);
  const openedResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !complete) return;
    const refresh = () =>
      void notificationState()
        .then((state) => {
          if (state === "enabled") return registerPushDevice();
        })
        .catch((error) =>
          console.error("Could not refresh push registration", error),
        );
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [session, complete]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (!authReady) {
        readyResponse.current = response;
        return;
      }
      const data = response.notification.request.content.data;
      const listId = typeof data?.listId === "string" ? data.listId : null;
      if (
        data?.type !== "household_activity" ||
        data.userId !== session?.user.id ||
        !listId
      ) {
        void Notifications.clearLastNotificationResponseAsync();
        return;
      }
      if (!complete || !households.some((household) => household.id === listId)) {
        readyResponse.current = response;
        return;
      }
      const responseId = response.notification.request.identifier;
      if (openedResponseId.current === responseId) return;
      openedResponseId.current = responseId;
      readyResponse.current = null;
      switchHousehold(listId);
      router.push("/household-activity");
      void Notifications.clearLastNotificationResponseAsync();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(open);
    return () => subscription.remove();
  }, [authReady, complete, households, router, session?.user.id, switchHousehold]);

  useEffect(() => {
    if (authReady && complete && readyResponse.current) {
      const response = readyResponse.current;
      readyResponse.current = null;
      const data = response.notification.request.content.data;
      const listId = typeof data?.listId === "string" ? data.listId : null;
      const userId = typeof data?.userId === "string" ? data.userId : null;
      const responseId = response.notification.request.identifier;
      if (
        listId &&
        userId === session?.user.id &&
        openedResponseId.current !== responseId &&
        households.some((household) => household.id === listId)
      ) {
        openedResponseId.current = responseId;
        switchHousehold(listId);
        router.push("/household-activity");
        void Notifications.clearLastNotificationResponseAsync();
      }
    }
  }, [authReady, complete, households, router, session?.user.id, switchHousehold]);

  return children;
}
