import { useEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useCommitTick } from "@/hooks/use-commit-tick";

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
  /** number of pages in the row */
  count: number;
  /** page the row rests on — follows the day strip */
  index: number;
  /**
   * Fires as soon as a swipe decides its page, while the settle spring is
   * still running, so the screen can mount the new neighbours in time.
   */
  onCommit: (index: number) => void;
};

/**
 * 1:1 pull-over pager for the day row. Every page has a fixed slot in one
 * long row and the drag moves a single offset — nothing is re-keyed or reset
 * on commit, so there's no JS/UI-thread frame to keep in sync. A new drag
 * picks the spring up mid-flight, so swipes can follow each other quickly.
 */
export function usePanSwipeDay({ width, count, index, onCommit }: Options) {
  const offset = useSharedValue(-index * width);
  const context = useSharedValue(0);
  const target = useSharedValue(index);
  const tick = useCommitTick();
  const laidOutWidth = useRef(width);
  const commitThreshold = Math.max(60, width * 0.3);

  // A tap in the day strip (or a width change) jumps straight to the page.
  useEffect(() => {
    if (target.get() === index && laidOutWidth.current === width) return;
    target.set(index);
    laidOutWidth.current = width;
    offset.set(-index * width);
  }, [index, width, offset, target]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10]) // vertical scroll always wins first
        .onStart(() => {
          context.set(offset.get());
          tick(0);
        })
        .onUpdate((e) => {
          const next = context.get() + e.translationX;
          const min = -(count - 1) * width;
          offset.set(
            next > 0
              ? rubberband(next, width, 0.15)
              : next < min
                ? min + rubberband(next - min, width, 0.15)
                : next,
          );
          const from = Math.round(-context.get() / width);
          const moved = offset.get() + from * width;
          tick(
            moved < -commitThreshold && from < count - 1
              ? 1
              : moved > commitThreshold && from > 0
                ? -1
                : 0,
          );
        })
        .onEnd((e) => {
          const from = Math.round(-context.get() / width);
          const moved = offset.get() + from * width + project(e.velocityX);
          const dir =
            moved < -commitThreshold ? 1 : moved > commitThreshold ? -1 : 0;
          const to = Math.min(count - 1, Math.max(0, from + dir));
          if (to !== from) {
            target.set(to);
            scheduleOnRN(onCommit, to);
          }
          offset.set(
            withSpring(-to * width, {
              duration: 300,
              dampingRatio: to !== from ? 1 : 0.8,
              velocity: e.velocityX,
              overshootClamping: to !== from,
              reduceMotion: ReduceMotion.System,
            }),
          );
        }),
    [width, count, commitThreshold, onCommit, offset, context, target, tick],
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  return { gesture, dragStyle };
}
