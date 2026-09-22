import { useMemo, useRef, useState } from "react";
import type { GestureResponderEvent, LayoutRectangle, View } from "react-native";
import {
  cubicBezier,
  type EntryAnimationsValues,
  Easing,
  FadeIn,
  ReduceMotion,
  useReducedMotion,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

type Selection = { recipeId: string; frame: LayoutRectangle };

const SELECTION_DURATION = 120;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SELECTION_SPRING = {
  duration: SELECTION_DURATION,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};
const SELECTION_FADE = {
  duration: SELECTION_DURATION,
  easing: Easing.bezier(...EASE_OUT),
  // Reduce Motion keeps the fades, but drops the spatial transition.
  reduceMotion: ReduceMotion.Never,
};
const DETAILS_ENTER = FadeIn.duration(SELECTION_FADE.duration)
  .easing(SELECTION_FADE.easing)
  .reduceMotion(ReduceMotion.Never);
const HEADING_FADE = {
  transitionProperty: "opacity",
  transitionDuration: SELECTION_DURATION,
  transitionTimingFunction: cubicBezier(...EASE_OUT),
} as const;

/**
 * Private to MealSection. Captures the chosen card before planning replaces
 * it, then coordinates the card entrance and persistent heading layers.
 */
export function useMealSelectionTransition(plannedRecipeId: string | undefined) {
  const reduced = useReducedMotion();
  const contentRef = useRef<View>(null);
  const measurementRequest = useRef(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const cardEnter = useMemo(() => {
    if (!selection || selection.recipeId !== plannedRecipeId) return undefined;
    const { frame } = selection;
    const clearSelection = () =>
      setSelection((current) => (current === selection ? null : current));

    return (target: EntryAnimationsValues) => {
      "worklet";
      const callback = () => {
        "worklet";
        scheduleOnRN(clearSelection);
      };
      if (reduced || target.targetWidth <= 0 || target.targetHeight <= 0) {
        return {
          initialValues: { opacity: 0 },
          animations: { opacity: withTiming(1, SELECTION_FADE) },
          callback,
        };
      }

      // Both frames are relative to the persistent content view, not the
      // window: the day pager and vertical scroll can move independently.
      // Transforms scale around the centre, so align the two centres first.
      return {
        initialValues: {
          transform: [
            {
              translateX:
                frame.x -
                target.targetOriginX +
                (frame.width - target.targetWidth) / 2,
            },
            {
              translateY:
                frame.y -
                target.targetOriginY +
                (frame.height - target.targetHeight) / 2,
            },
            { scaleX: frame.width / target.targetWidth },
            { scaleY: frame.height / target.targetHeight },
          ],
        },
        animations: {
          transform: [
            { translateX: withSpring(0, SELECTION_SPRING) },
            { translateY: withSpring(0, SELECTION_SPRING) },
            { scaleX: withSpring(1, SELECTION_SPRING) },
            { scaleY: withSpring(1, SELECTION_SPRING) },
          ],
        },
        callback,
      };
    };
  }, [selection, plannedRecipeId, reduced]);

  function selectContender(
    contenderId: string,
    event: GestureResponderEvent,
    plan: () => void,
  ) {
    const content = contentRef.current;
    const card = event.currentTarget;
    const request = ++measurementRequest.current;
    if (!content || typeof card === "number") {
      setSelection(null);
      plan();
      return;
    }

    // Window measurements include the carousel's current scroll offset.
    card.measureInWindow((x, y, width, height) => {
      content.measureInWindow((contentX, contentY) => {
        if (
          contentRef.current !== content ||
          measurementRequest.current !== request
        )
          return;
        setSelection(
          width > 0 && height > 0
            ? {
                recipeId: contenderId,
                frame: { x: x - contentX, y: y - contentY, width, height },
              }
            : null,
        );
        plan();
      });
    });
  }

  const planned = plannedRecipeId !== undefined;
  return {
    contentRef,
    selectContender,
    cardEnter,
    detailsEnter: cardEnter && !reduced ? DETAILS_ENTER : undefined,
    choosingHeadingStyle: { ...HEADING_FADE, opacity: planned ? 0 : 1 },
    plannedHeadingStyle: { ...HEADING_FADE, opacity: planned ? 1 : 0 },
  };
}
