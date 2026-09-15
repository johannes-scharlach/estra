import { useMemo } from "react";
import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** Momentum projection — Apple's exponential-decay form. */
function project(velocity: number, decelerationRate = 0.998) {
  "worklet";
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past the edge, the less the row follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  "worklet";
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

type Options = {
  width: number;
  /** previous day exists — dragging right may pull it in */
  canGoPrev: boolean;
  /** next day exists — dragging left may pull it in */
  canGoNext: boolean;
  /**
   * Fires once the pulled page has landed. The screen swaps the selected day
   * and snaps the row back to center in the same frame (see reset below).
   */
  onCommit: (dir: 1 | -1) => void;
};

/**
 * 1:1 pull-over pager for the day row. The drag offset is a shared value —
 * no setState per frame. Velocity is handed to the settle spring, so a flick
 * commits and a slow drag past ~30% of the width commits too.
 */
export function usePanSwipeDay({
  width,
  canGoPrev,
  canGoNext,
  onCommit,
}: Options) {
  const translateX = useSharedValue(0);
  const context = useSharedValue(0);
  const commitThreshold = Math.max(60, width * 0.3);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10]) // vertical scroll always wins first
        .onStart(() => {
          context.set(translateX.get());
        })
        .onUpdate((e) => {
          const next = context.get() + e.translationX;
          if (next > 0) {
            // pulling the previous page in; rest is 0, page fully in at +width
            const limit = canGoPrev ? width : 0;
            translateX.set(
              next > limit ? limit + rubberband(next - limit, width, 0.15) : next,
            );
          } else {
            // pulling the next page in; page fully in at -width
            const limit = canGoNext ? -width : 0;
            translateX.set(
              next < limit ? limit + rubberband(next - limit, width, 0.15) : next,
            );
          }
        })
        .onEnd((e) => {
          const projected = translateX.get() + project(e.velocityX);
          const dir =
            projected < -commitThreshold && canGoNext
              ? 1
              : projected > commitThreshold && canGoPrev
                ? -1
                : 0;
          if (dir !== 0) {
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
            translateX.set(
              withSpring(
                dir * -width,
                {
                  duration: 300,
                  dampingRatio: 1,
                  velocity: e.velocityX,
                  overshootClamping: true,
                  reduceMotion: ReduceMotion.System,
                },
                (finished) => {
                  if (finished) scheduleOnRN(onCommit, dir);
                },
              ),
            );
          } else {
            translateX.set(
              withSpring(0, {
                duration: 300,
                dampingRatio: 0.8,
                velocity: e.velocityX,
                reduceMotion: ReduceMotion.System,
              }),
            );
          }
        }),
    [width, canGoPrev, canGoNext, commitThreshold, onCommit, translateX, context],
  );

  const dragStyle = useAnimatedStyle(() => ({
    // rest position centers the middle page of the [prev, current, next] row
    transform: [{ translateX: translateX.get() - width }],
  }));

  return { gesture, dragStyle, translateX };
}
