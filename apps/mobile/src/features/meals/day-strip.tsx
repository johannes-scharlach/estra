import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
  type ViewStyle,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { dateKey, WEEKDAY_SHORT } from "./slots";

/** Fixed chip geometry keeps scroll-to-center math trivial. */
const CHIP_W = 48; // w-12
const UNIT = CHIP_W + 8; // gap-2
const EDGE_PAD = 24; // contentContainer paddingHorizontal, matches px-6
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

type Props = {
  dates: Date[];
  todayIndex: number;
  selected: string;
  onSelect: (key: string) => void;
  className?: string;
};

/** Horizontally scrollable date tabs, past days left, planned days right. */
export function DayStrip({
  dates,
  todayIndex,
  selected,
  onSelect,
  className,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const didInit = useRef(false);
  const isFirstRender = useRef(true);

  const selectedIndex = dates.findIndex((d) => dateKey(d) === selected);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : todayIndex;
  const targetX = activeIndex * UNIT;

  const translateX = useSharedValue(targetX);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      translateX.value = targetX;
      return;
    }
    translateX.value = withTiming(targetX, {
      duration: 250,
      easing: EASE_IN_OUT,
    });
  }, [targetX, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const glassStyle: ViewStyle = isDark
    ? {
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        borderColor: "rgba(255, 255, 255, 0.18)",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        borderCurve: "continuous",
        boxShadow:
          "0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0.5px rgba(255, 255, 255, 0.25)",
      }
    : {
        backgroundColor: "rgba(255, 255, 255, 0.88)",
        borderColor: "rgba(0, 0, 0, 0.08)",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        borderCurve: "continuous",
        boxShadow:
          "0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 0.5px rgba(255, 255, 255, 0.95)",
      };

  function center(index: number, animated: boolean) {
    scrollRef.current?.scrollTo({
      x: Math.max(
        0,
        EDGE_PAD + index * UNIT + CHIP_W / 2 - viewport.current / 2,
      ),
      animated,
    });
  }

  function initCenter() {
    if (didInit.current) return;
    didInit.current = true;
    center(todayIndex, false);
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ overflow: "visible" }}
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.width;
        initCenter();
      }}
      onContentSizeChange={initCenter}
      contentContainerStyle={{
        paddingHorizontal: EDGE_PAD,
        paddingTop: 6,
        paddingBottom: 12,
      }}
      className={cn(className)}
    >
      <View style={{ flexDirection: "row", gap: 8, position: "relative" }}>
        {/* Animated active day liquid glass pill indicator */}
        {selectedIndex >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                width: CHIP_W,
                height: 56,
              },
              glassStyle,
              indicatorStyle,
            ]}
          >
            <GlassView
              isInteractive
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 12, borderCurve: "continuous" },
              ]}
            />
          </Animated.View>
        ) : null}

        {dates.map((d, i) => {
          const key = dateKey(d);
          const isSelected = key === selected;

          return (
            <Pressable
              key={key}
              onPress={() => {
                translateX.value = withTiming(i * UNIT, {
                  duration: 250,
                  easing: EASE_IN_OUT,
                });
                onSelect(key);
                center(i, true);
              }}
              className="h-14 w-12 items-center justify-center gap-0.5 rounded-xl"
              style={{ borderCurve: "continuous" }}
            >
              <Text
                className={cn(
                  "text-[10px] uppercase tracking-wider",
                  isSelected
                    ? "font-semibold text-foreground"
                    : i === todayIndex
                      ? "font-medium text-foreground"
                      : "font-medium text-muted-foreground",
                )}
              >
                {i === todayIndex ? "Today" : WEEKDAY_SHORT[d.getDay()]}
              </Text>
              <Text
                className={cn(
                  "text-sm tabular-nums",
                  isSelected
                    ? "font-bold text-foreground"
                    : "font-semibold text-foreground",
                )}
              >
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}



