import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useResolveClassNames } from "uniwind";

import type { Alternative } from "./alternatives";

export function SwipeItem({
  leading,
  children,
  name,
  next,
  previous,
  disabled,
  onSwap,
  onOpen,
  renderOption,
}: {
  leading: ReactNode;
  children: ReactNode;
  name: string;
  next: Alternative | null | undefined;
  previous: Alternative | null | undefined;
  disabled: boolean;
  onSwap: (direction: 1 | -1) => Promise<boolean>;
  onOpen: () => void;
  renderOption: (option: Alternative) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [transition, setTransition] = useState<{
    children: ReactNode;
    next: Alternative | null | undefined;
    previous: Alternative | null | undefined;
    target: string;
  } | null>(null);
  const [settled, setSettled] = useState(false);
  const [saved, setSaved] = useState(false);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const locked = useSharedValue(false);
  const reduced = useReducedMotion();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const pageWidth = width;
  // The Swap icon stays faint until a finger is on the row.
  const pressed = useSharedValue(0);
  const press = useCallback(
    (down: boolean) => {
      "worklet";
      pressed.set(withTiming(down ? 1 : 0, { duration: down ? 100 : 300 }));
    },
    [pressed],
  );

  const commit = useCallback(
    async (direction: 1 | -1) => {
      const target = direction === 1 ? next : previous;
      if (!target) {
        x.set(
          withSpring(0, {
            duration: 400,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.System,
          }),
        );
        locked.set(false);
        return;
      }
      // Keep the outgoing content stable while the local write updates the live row.
      setTransition({ children, next, previous, target: target.name.trim() });
      setSaved(false);
      setSettled(false);
      const success = await onSwap(direction);
      if (success) {
        setSaved(true);
      } else {
        setTransition(null);
        x.set(
          withSpring(0, {
            duration: 400,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.System,
          }),
        );
        locked.set(false);
      }
    },
    [children, next, previous, onSwap, locked, x],
  );

  const completed = !!(
    transition &&
    settled &&
    saved &&
    name === transition.target
  );
  useLayoutEffect(() => {
    if (!completed) return;
    // The incoming preview is now at x=0; hand it over to the live item in place.
    x.set(0);
    locked.set(false);
  }, [completed, locked, x]);

  const animateSwap = useCallback(
    (direction: 1 | -1, velocity: number) => {
      "worklet";
      locked.set(true);
      scheduleOnRN(commit, direction);
      x.set(
        withSpring(
          -direction * pageWidth,
          {
            duration: 400,
            dampingRatio: 1,
            velocity,
            overshootClamping: true,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) scheduleOnRN(setSettled, true);
          },
        ),
      );
    },
    [commit, locked, pageWidth, x],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && !!(next || previous) && pageWidth > 0)
        .activeOffsetX([-10, 10])
        .failOffsetY([-16, 16])
        .onBegin(() => press(true))
        .onStart(() => {
          if (!locked.get()) start.set(x.get());
        })
        .onUpdate((event) => {
          if (locked.get()) return;
          const distance = start.get() + event.translationX;
          const boundary =
            (!previous && distance > 0) || (!next && distance < 0)
              ? 0
              : distance;
          const edge = Math.sign(boundary) * pageWidth;
          const overshoot = boundary - edge;
          x.set(
            Math.abs(boundary) <= pageWidth
              ? boundary
              : edge + overshoot / (1 + Math.abs(overshoot) / 40),
          );
        })
        .onEnd((event) => {
          if (locked.get()) return;
          const projected = x.get() + event.velocityX * 0.15;
          const canCommit = projected < 0 ? !!next : !!previous;
          if (
            canCommit &&
            Math.abs(projected) > Math.min(72, pageWidth * 0.3)
          ) {
            const direction = projected < 0 ? 1 : -1;
            animateSwap(direction, event.velocityX);
          } else {
            x.set(
              withSpring(0, {
                duration: 400,
                dampingRatio: 0.8,
                velocity: event.velocityX,
                reduceMotion: ReduceMotion.System,
              }),
            );
          }
        })
        .onFinalize((_event, success) => {
          press(false);
          if (!success && !locked.get())
            x.set(
              withSpring(0, {
                duration: 400,
                dampingRatio: 1,
                reduceMotion: ReduceMotion.System,
              }),
            );
        }),
    [disabled, next, previous, pageWidth, animateSwap, locked, press, start, x],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(8)
        .onEnd((_event, success) => {
          if (success && !locked.get()) scheduleOnRN(onOpen);
        }),
    [locked, onOpen],
  );
  // A drag that fails the pan's axis test must not fall through to a tap.
  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? 0 : x.get() }],
  }));
  const nextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageWidth + (reduced ? 0 : x.get()) }],
  }));
  const previousStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth + (reduced ? 0 : x.get()) }],
  }));
  const restingIconStyle = useAnimatedStyle(() => ({
    opacity: 0.3 * (1 - pressed.get()),
  }));
  const pressedIconStyle = useAnimatedStyle(() => ({
    opacity: pressed.get(),
  }));
  const shownNext = transition && !completed ? transition.next : next;
  const shownPrevious =
    transition && !completed ? transition.previous : previous;
  // Tapping the hint swaps forward while there is a next option, else back.
  const hint = next ? 1 : previous ? -1 : null;
  const hintTap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(hint !== null && !disabled && pageWidth > 0)
        .onBegin(() => press(true))
        .onFinalize(() => press(false))
        .onEnd((_event, success) => {
          if (success && !locked.get() && hint !== null) animateSwap(hint, 0);
        }),
    [animateSwap, disabled, hint, locked, pageWidth, press],
  );

  return (
    <View className="flex-1 flex-row items-center">
      {leading}
      <View
        className="flex-1 overflow-hidden"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <GestureDetector gesture={gesture}>
          <Animated.View>
            <Animated.View style={rowStyle}>
              {transition && !completed ? transition.children : children}
            </Animated.View>
            {[
              {
                key: "next",
                option: shownNext,
                style: nextStyle,
              },
              {
                key: "previous",
                option: shownPrevious,
                style: previousStyle,
              },
            ].map(({ key, option, style }) =>
              option && width ? (
                <Animated.View
                  key={key}
                  style={[style, { width: pageWidth }]}
                  className="absolute bottom-0 left-0 top-0"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View className="min-h-12 gap-0.5 px-3 py-3">
                    {renderOption(option)}
                  </View>
                </Animated.View>
              ) : null,
            )}
          </Animated.View>
        </GestureDetector>
      </View>
      {/* Every row keeps the slot so amounts line up and never shift on swap. */}
      <GestureDetector gesture={hintTap}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="w-10 self-stretch items-center justify-center"
        >
          {hint !== null && !disabled
            ? [
                { key: "resting", style: restingIconStyle, color: mutedColor },
                {
                  key: "pressed",
                  style: pressedIconStyle,
                  color: primaryColor,
                },
              ].map(({ key, style, color }) => (
                <Animated.View
                  key={key}
                  style={style}
                  className="absolute top-3 h-6 justify-center"
                >
                  <SymbolView
                    name={{
                      ios: "arrow.left.arrow.right",
                      android: "swap_horiz",
                    }}
                    tintColor={color}
                    size={15}
                  />
                </Animated.View>
              ))
            : null}
        </View>
      </GestureDetector>
    </View>
  );
}
