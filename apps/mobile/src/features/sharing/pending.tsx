import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { sharedVariantId } from "./links";

const KEY = "magpie.pending-shared-recipe.v1";

/** Done with this link: a later app start won't reopen it. */
export async function clearPendingShare(variantId: string) {
  if ((await AsyncStorage.getItem(KEY)) === variantId)
    await AsyncStorage.removeItem(KEY);
}

/**
 * A share link opened before sign-in or onboarding can't show its route yet.
 * Keep it on the device and open it once the app is showing (ADR 28), like
 * an invitation. Links opened in the app route themselves.
 */
export function PendingShare({ showApp }: { showApp: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const opened = useRef<string | null>(null);

  useEffect(() => {
    const keep = (url: string | null) => {
      const id = sharedVariantId(url);
      if (id) void AsyncStorage.setItem(KEY, id).catch(() => {});
    };
    void Linking.getInitialURL().then(keep);
    const subscription = Linking.addEventListener("url", ({ url }) => keep(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!showApp) return;
    let active = true;
    void AsyncStorage.getItem(KEY)
      .then((id) => {
        if (!active || !id || opened.current === id) return;
        opened.current = id;
        if (pathname !== `/shared/${id}`)
          router.push({ pathname: "/shared/[id]", params: { id } });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // Only when the app becomes available; later links route themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showApp]);

  return null;
}
