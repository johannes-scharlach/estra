import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

const INSTALLATION_KEY = "estra.notifications.installation.v1";
const PROMPT_KEY = "estra.notifications.prompted.v1";
export const HOUSEHOLD_CHANNEL = "household-activity";

export type NotificationState = "enabled" | "disabled" | "not-asked";

export async function notificationState(): Promise<NotificationState> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) return "enabled";
  return permissions.canAskAgain ? "not-asked" : "disabled";
}

export async function wasNotificationPrompted(
  userId: string,
): Promise<boolean> {
  return (await AsyncStorage.getItem(`${PROMPT_KEY}:${userId}`)) === "true";
}

export async function markNotificationPrompted(userId: string): Promise<void> {
  await AsyncStorage.setItem(`${PROMPT_KEY}:${userId}`, "true");
}

export async function enableNotifications(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  const permissions = current.granted
    ? current
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
  if (!permissions.granted) return false;
  await registerPushDevice();
  return true;
}

export async function registerPushDevice(): Promise<void> {
  // Simulators and emulators cannot receive push tokens. This runs on every
  // foregrounding via the provider, so silently skip instead of logging.
  if (!Device.isDevice) return;
  await ensureAndroidChannel();
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Missing Expo project ID.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc("register_push_device", {
    target_installation_id: await installationId(),
    target_expo_push_token: token.data,
    target_platform: Platform.OS,
  });
  if (error) throw error;
}

export async function unregisterPushDevice(
  target_reason: "signed_out" | "permission_revoked" = "signed_out",
): Promise<void> {
  const id = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (!id) return;
  const { error } = await supabase.rpc("unregister_push_device", {
    target_installation_id: id,
    target_reason,
  });
  if (error) throw error;
}

export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}

async function installationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(HOUSEHOLD_CHANNEL, {
    name: "Household activity",
    description: "Changes to who shares your household",
    importance: Notifications.AndroidImportance.DEFAULT,
    // No `sound`: omitting uses the system default. A string here names a
    // bundled custom sound file and logs when it doesn't exist.
  });
}
