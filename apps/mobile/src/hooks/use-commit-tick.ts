import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Android-style drag feedback: one light tick when letting go would commit,
 * again each time the drag re-crosses into it. The landing itself is visible,
 * so it gets no haptic.
 *
 * Call with the direction a release would commit to (0 = springs back) from
 * the pan's onUpdate, and with 0 from onStart.
 */
export function useCommitTick() {
  const armed = useSharedValue(0);
  return useCallback(
    (dir: number) => {
      "worklet";
      if (dir === armed.get()) return;
      armed.set(dir);
      if (dir !== 0)
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
    },
    [armed],
  );
}
