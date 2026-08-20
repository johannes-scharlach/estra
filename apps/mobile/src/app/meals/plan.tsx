import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  TextInput,
  View,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const MEALS = ["lunch", "dinner"] as const;
type Meal = (typeof MEALS)[number];

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const keyOf = (dayIndex: number, meal: Meal) => `${dayIndex}-${meal}`;

/** Rolling 7 days starting today. */
function rollingWeek(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i);
    return day;
  });
}

type Box = { x: number; y: number; width: number; height: number };

export default function PlanMeals() {
  const [days] = useState(rollingWeek);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const iconColor = useResolveClassNames("text-muted-foreground").color;

  // Mirror of `picked` for the gesture handlers — they are created once, so
  // they cannot close over state. setSlot is the only writer, keeping the two
  // in sync.
  const pickedRef = useRef(picked);
  const drag = useRef<{ paint: boolean; meal: Meal; startKey: string } | null>(
    null,
  );
  const rowRefs = useRef<(View | null)[]>([]);
  const rowBoxes = useRef<Box[]>([]);

  /**
   * RN has no elementFromPoint, so drag-paint hit-tests against the measured
   * layout of each meal row. Measure at gesture start, not onLayout: a
   * snapshot taken at layout time goes stale without another layout pass
   * (screen slide-in transition, keyboard avoidance shifting the grid), and
   * then cellAt never matches.
   */
  function measureRows(done: () => void) {
    const rows = MEALS.map((_, row) => row).filter(
      (row) => rowRefs.current[row],
    );
    if (rows.length === 0) return;
    let left = rows.length;
    for (const row of rows) {
      rowRefs.current[row]?.measureInWindow((x, y, width, height) => {
        rowBoxes.current[row] = { x, y, width, height };
        if (--left === 0) done();
      });
    }
  }

  /**
   * Cells are inert views; one PanResponder on the grid body handles both
   * taps and swipes.
   */
  function cellAt(pageX: number, pageY: number) {
    for (const [row, meal] of MEALS.entries()) {
      const box = rowBoxes.current[row];
      if (!box) continue;
      if (pageX < box.x || pageY < box.y || pageY > box.y + box.height)
        continue;
      const dayIndex = Math.min(
        6,
        Math.floor(((pageX - box.x) / box.width) * 7),
      );
      return { dayIndex, meal };
    }
    return null;
  }

  function setSlot(key: string, value: boolean) {
    pickedRef.current = { ...pickedRef.current, [key]: value };
    setPicked(pickedRef.current);
  }

  // PanResponder.create must run once; its callbacks only fire at gesture
  // time, never during render, so reading refs inside them is safe.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only steal horizontal moves — vertical scroll keeps working.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        measureRows(() => {
          const cell = cellAt(pageX, pageY);
          if (!cell) return;
          const key = keyOf(cell.dayIndex, cell.meal);
          const paint = !pickedRef.current[key];
          drag.current = { paint, meal: cell.meal, startKey: key };
          setSlot(key, paint);
        });
      },
      onPanResponderMove: (e) => {
        const d = drag.current;
        if (!d) return;
        const cell = cellAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (!cell || cell.meal !== d.meal) return;
        const key = keyOf(cell.dayIndex, cell.meal);
        if (!!pickedRef.current[key] !== d.paint) setSlot(key, d.paint);
      },
      onPanResponderRelease: () => {
        drag.current = null;
      },
      // A scroll view stole the gesture — undo the tap so scrolling never
      // flips a slot.
      onPanResponderTerminate: () => {
        if (drag.current) setSlot(drag.current.startKey, !drag.current.paint);
        drag.current = null;
      },
    }),
  );

  return (
    <>
      {/* Chevron-only back button: the screen below is the (tabs) container,
          so a title label would leak the route name or lie about the source tab. */}
      <Stack.Screen
        options={{
          title: "Plan meals",
          headerBackButtonDisplayMode: "minimal",
          // iOS 26 makes the back swipe full-screen by default, and that
          // native recognizer steals the drag-paint gesture. Keep it
          // edge-only on this screen.
          fullScreenGestureEnabled: false,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 gap-6 bg-background p-6">
          <Text variant="h3">Plan next meals</Text>

          <View className="gap-1.5">
            <View className="flex-row gap-1.5">
              <View className="w-14" />
              {days.map((day, i) => (
                <Text
                  key={day.toDateString()}
                  className={cn(
                    "flex-1 text-center text-[11px] font-medium uppercase tracking-wider",
                    i === 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {WEEKDAY_LETTERS[day.getDay()]}
                </Text>
              ))}
            </View>

            <View className="gap-1.5" {...pan.panHandlers}>
              {MEALS.map((meal, row) => (
                <View key={meal} className="flex-row items-center gap-1.5">
                  <Text className="w-14 pr-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {meal}
                  </Text>
                  <View
                    ref={(v) => {
                      rowRefs.current[row] = v;
                    }}
                    className="flex-1 flex-row gap-1.5"
                  >
                    {days.map((day, dayIndex) => {
                      const on = !!picked[keyOf(dayIndex, meal)];
                      return (
                        <View
                          key={day.toDateString()}
                          className={cn(
                            "h-9 flex-1 items-center justify-center rounded-sm",
                            on ? "bg-secondary shadow-sm" : "bg-muted/45",
                          )}
                        >
                          {on ? (
                            <View className="size-1.5 rounded-full bg-secondary-foreground/70" />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="gap-1">
            <Text variant="large">What should we cook with?</Text>
            <Text variant="muted">Guests or anything to keep in mind?</Text>
          </View>

          <View className="rounded-xl border border-border bg-card shadow-sm shadow-black/5">
            <TextInput
              multiline
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
              className="min-h-28 px-4 py-3 text-base text-foreground"
            />
            <View className="h-px bg-border" />
            {/* Placeholders — photo and voice notes are not wired up yet. */}
            <View className="flex-row gap-5 px-4 py-3">
              <SymbolView
                name={{ ios: "camera", android: "photo_camera", web: "photo_camera" }}
                tintColor={iconColor}
                size={22}
              />
              <SymbolView
                name={{ ios: "mic", android: "mic", web: "mic" }}
                tintColor={iconColor}
                size={22}
              />
            </View>
          </View>

          <View className="flex-1" />

          <Button
            size="lg"
            onPress={() =>
              console.log("Draft my plan", {
                slots: Object.keys(picked).filter((k) => picked[k]),
                notes,
              })
            }
          >
            <Text>Draft my plan</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
