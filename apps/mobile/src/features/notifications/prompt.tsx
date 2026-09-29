import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  notificationState,
  wasNotificationPrompted,
} from "./notifications";

export function NotificationPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const { complete } = useHouseholdAccess();
  const userId = session?.user.id;
  useEffect(() => {
    if (
      !userId ||
      !complete ||
      pathname === "/join" ||
      pathname === "/notifications"
    )
      return;
    let active = true;
    Promise.all([notificationState(), wasNotificationPrompted(userId)])
      .then(([state, prompted]) => {
        if (active && state === "not-asked" && !prompted) {
          router.push("/notifications" as never);
        }
      })
      .catch((error) => console.error("Could not prepare notification prompt", error));
    return () => {
      active = false;
    };
  }, [complete, pathname, router, userId]);
  return null;
}
