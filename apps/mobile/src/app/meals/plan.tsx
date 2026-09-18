import * as Crypto from "expo-crypto";
import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { mealPlanMessage } from "@/features/chat/compose";
import {
  pickImageAttachments,
  type ImageAttachment,
  type ImageSource,
} from "@/features/chat/image-attachment";
import { ImageAttachmentMenu } from "@/features/chat/image-attachment-menu";
import { ImageAttachmentStrip } from "@/features/chat/image-attachment-strip";
import { queueMessage } from "@/features/chat/message-queue";
import { dateKey, MONTH_SHORT, WEEKDAY_LONG } from "@/features/meals/slots";
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [days] = useState(rollingWeek);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [pickingAttachments, setPickingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const starting = useRef(false);

  const slots = days.flatMap((day, dayIndex) =>
    MEALS.filter((meal) => picked[keyOf(dayIndex, meal)]).map((meal) => ({
      day: dateKey(day),
      meal,
    })),
  );

  async function addAttachments(source: ImageSource) {
    if (pickingAttachments) return;
    setPickingAttachments(true);
    setAttachmentError(null);
    try {
      const picked = await pickImageAttachments(source);
      if (picked.length) setAttachments((current) => [...current, ...picked]);
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : "Could not add images. Try again.",
      );
    } finally {
      setPickingAttachments(false);
    }
  }

  function start() {
    if (!slots.length || pickingAttachments || starting.current) return;
    starting.current = true;
    const chatId = Crypto.randomUUID();
    queueMessage({
      messageId: Crypto.randomUUID(),
      text: mealPlanMessage({
        slots,
        notes,
        attachmentCount: attachments.length,
      }),
      attachments,
    });
    // The form is the entry, not a step to revisit after sending it.
    router.replace(`/chats/${chatId}` as never);
  }

  // Mirror of `picked` for the gesture handlers — they are created once, so
  // they cannot close over state. setSlot is the only writer, keeping the two
  // in sync.
  const pickedRef = useRef(picked);
  const drag = useRef<{ paint: boolean; meal: Meal; startKey: string } | null>(
    null,
  );
  const rowRefs = useRef<(View | null)[]>([]);
  const rowBoxes = useRef<Box[]>([]);
  const gesture = useRef<{ released: boolean; cancelled: boolean } | null>(
    null,
  );

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
      const top = box.y - (row === 0 ? 6 : 0);
      const bottom = box.y + box.height + (row === MEALS.length - 1 ? 6 : 0);
      if (
        pageX < box.x - 6 ||
        pageX > box.x + box.width + 6 ||
        pageY < top ||
        pageY >= bottom
      )
        continue;
      const dayIndex = Math.min(
        6,
        Math.max(0, Math.floor(((pageX - box.x) / box.width) * 7)),
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
      onShouldBlockNativeResponder: () => false,
      // Only steal horizontal moves — vertical scroll keeps working.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        const currentGesture = { released: false, cancelled: false };
        gesture.current = currentGesture;
        const { pageX, pageY } = e.nativeEvent;
        measureRows(() => {
          if (currentGesture.cancelled) return;
          const cell = cellAt(pageX, pageY);
          if (!cell) return;
          const key = keyOf(cell.dayIndex, cell.meal);
          const paint = !pickedRef.current[key];
          if (!currentGesture.released) {
            drag.current = { paint, meal: cell.meal, startKey: key };
          }
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
        // A completed tap still counts if its measurement arrives after release.
        if (gesture.current) gesture.current.released = true;
        drag.current = null;
      },
      // A scroll view stole the gesture — undo the tap so scrolling never
      // flips a slot.
      onPanResponderTerminate: () => {
        if (gesture.current) gesture.current.cancelled = true;
        gesture.current = null;
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
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-6 p-6"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View className="gap-2">
            <Text variant="h3">Which meals do you want to plan?</Text>
            <Text variant="muted">
              Tap or swipe to select meals for the next seven days.
            </Text>
          </View>

          <View className="gap-1.5">
            <View className="flex-row gap-1.5">
              <View className="w-14" />
              <View className="flex-1 flex-row">
                {days.map((day, i) => (
                  <Text
                    key={day.toDateString()}
                    className={cn(
                      "flex-1 text-center text-[11px] font-medium uppercase tracking-wider",
                      i === 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {WEEKDAY_LETTERS[day.getDay()]}
                    {"\n"}
                    {day.getDate()}
                  </Text>
                ))}
              </View>
            </View>

            <View className="-mx-1.5 px-1.5 py-1.5" {...pan.panHandlers}>
              {MEALS.map((meal, row) => (
                <View key={meal} className="flex-row items-center gap-1.5">
                  <Text className="w-14 pr-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {meal}
                  </Text>
                  <View
                    ref={(v) => {
                      rowRefs.current[row] = v;
                    }}
                    className="flex-1 flex-row"
                  >
                    {days.map((day, dayIndex) => {
                      const on = !!picked[keyOf(dayIndex, meal)];
                      return (
                        <View
                          key={day.toDateString()}
                          accessible
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${WEEKDAY_LONG[day.getDay()]}, ${MONTH_SHORT[day.getMonth()]} ${day.getDate()}, ${meal}`}
                          accessibilityState={{ checked: on }}
                          accessibilityActions={[
                            { name: "activate", label: "Toggle meal" },
                          ]}
                          onAccessibilityAction={() =>
                            setSlot(
                              keyOf(dayIndex, meal),
                              !pickedRef.current[keyOf(dayIndex, meal)],
                            )
                          }
                          className="h-12 flex-1 justify-center px-[3px]"
                        >
                          <View
                            className={cn(
                              "h-9 items-center justify-center rounded-sm",
                              on ? "bg-secondary" : "bg-muted/45",
                            )}
                          >
                            {on ? (
                              <View className="size-1.5 rounded-full bg-secondary-foreground/70" />
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text variant="large">What do you have in mind? (optional)</Text>

          <View className="rounded-xl border border-border bg-card">
            <TextInput
              multiline
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
              accessibilityLabel="What do you have in mind? (optional)"
              placeholder="Something you're craving, quick dinners, guests, ingredients to use up…"
              className="min-h-28 px-4 py-3 text-base text-foreground"
            />
            <View className="h-px bg-border" />
            <View className="gap-2 px-4 py-2">
              <ImageAttachmentStrip
                attachments={attachments}
                onRemove={(index) =>
                  setAttachments((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
                size={80}
              />
              <View className="self-start">
                <ImageAttachmentMenu
                  onSelect={(source) => void addAttachments(source)}
                  disabled={pickingAttachments}
                  label={
                    pickingAttachments
                      ? "Opening images..."
                      : attachments.length
                        ? "Add more images"
                        : "Add images"
                  }
                />
              </View>
              {attachmentError ? (
                <Text className="text-destructive" accessibilityRole="alert">
                  {attachmentError}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <View
          className="px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            size="lg"
            className="min-h-12"
            disabled={!slots.length || pickingAttachments}
            onPress={start}
          >
            <Text>Start planning</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
