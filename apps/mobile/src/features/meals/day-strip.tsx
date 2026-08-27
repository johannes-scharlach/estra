import { useRef } from "react";
import { Pressable, ScrollView } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { dateKey, WEEKDAY_SHORT } from "./slots";

/** Fixed chip geometry keeps scroll-to-center math trivial. */
const CHIP_W = 48; // w-12
const UNIT = CHIP_W + 8; // gap-2
const EDGE_PAD = 24; // contentContainer paddingHorizontal, matches px-6

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
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const didInit = useRef(false);

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
      onLayout={(e) => {
        viewport.current = e.nativeEvent.layout.width;
        initCenter();
      }}
      onContentSizeChange={initCenter}
      contentContainerStyle={{
        paddingHorizontal: EDGE_PAD,
        paddingVertical: 8,
        gap: 8,
      }}
      className={cn(className)}
    >
      {dates.map((d, i) => {
        const key = dateKey(d);
        const isSelected = key === selected;
        return (
          <Pressable
            key={key}
            onPress={() => {
              onSelect(key);
              center(i, true);
            }}
            className={cn(
              "h-14 w-12 items-center justify-center gap-0.5 rounded-xl",
              isSelected && "bg-secondary",
            )}
          >
            <Text
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                isSelected
                  ? "text-secondary-foreground"
                  : i === todayIndex
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {i === todayIndex ? "Today" : WEEKDAY_SHORT[d.getDay()]}
            </Text>
            <Text
              className={cn(
                "text-sm font-semibold",
                isSelected ? "text-secondary-foreground" : "text-foreground",
              )}
            >
              {d.getDate()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
