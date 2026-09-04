import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { List, Variant } from "@/db/schema";
import { setPlannedMeal } from "@/db/planned-meals";
import { saveAndPlanMessage } from "@/features/chat/compose";
import { queueMessage } from "@/features/chat/message-queue";
import { DayStrip } from "@/features/meals/day-strip";
import {
  dateKey,
  SLOT_LABEL,
  SLOT_ORDER,
  stripDates,
  type MealSlot,
} from "@/features/meals/slots";

const MINUS_ICON = { ios: "minus", android: "remove", web: "remove" } as const;
const PLUS_ICON = { ios: "plus", android: "add", web: "add" } as const;

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so picker state is always fresh.
 *
 *  Two modes: with a variant id it plans that recipe; with `dish` instead
 *  (from a chat Sketch's Save & plan) it is a pending form — nothing runs
 *  behind the sheet, and confirming sends one chat message stating exactly
 *  what was agreed; the assistant does the save + plan (two tool calls). */
export default function PlanVariantSheet() {
  const { id, dish } = useLocalSearchParams<{ id?: string; dish?: string }>();
  const router = useRouter();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, never>>>();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  const pending = !id;
  const { data: variants } = useQuery<Variant>(
    "SELECT * FROM variants WHERE id = ? LIMIT 1",
    [id ?? ""],
  );
  const variant = variants[0];
  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY name ASC",
  );

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    dateKey(new Date()),
  );
  const [selectedMeal, setSelectedMeal] = useState<MealSlot>("dinner");
  const [servings, setServings] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strip = useMemo(() => stripDates(0), []);
  const effectiveListId = selectedListId ?? lists[0]?.id ?? null;

  // react-native-screens #3634: a ScrollView mounted while the formSheet
  // presents gets its native frame mangled (fitToContents measuring pass).
  // Mount the strip only after the sheet transition settles.
  const [stripReady, setStripReady] = useState(false);
  useEffect(
    () =>
      navigation.addListener("transitionEnd", (e) => {
        if (!e.data.closing) setStripReady(true);
      }),
    [navigation],
  );

  async function onAdd() {
    if (pending) {
      // The commit: one honest message back on the chat screen.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queueMessage({
        messageId: Crypto.randomUUID(),
        text: saveAndPlanMessage({ day: selectedDate, meal: selectedMeal, servings }),
        photo: null,
      });
      router.back();
      return;
    }
    if (!variant?.recipe_id || !effectiveListId) return;
    setSaving(true);
    setError(null);
    try {
      await setPlannedMeal({
        listId: effectiveListId,
        slotDate: selectedDate,
        meal: selectedMeal,
        recipeId: variant.recipe_id,
        variantId: variant.id,
        servings,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : "Could not add to plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Sections are direct children of the screen root: react-native-screens
          #3634 — inside a formSheet, ScrollView frames get mangled unless the
          scroll view is a direct subview of the content wrapper. Keep DayStrip
          at this depth; do not wrap it. */}
      <View className="gap-1 px-6 pt-4">
        <Text className="text-lg font-semibold">
          {pending ? "Save & plan" : "Add to plan"}
        </Text>
        <Text variant="muted" className="text-sm" numberOfLines={1}>
          {pending ? (dish ?? "This recipe") : (variant?.name ?? "…")}
        </Text>
      </View>

      {lists.length > 1 ? (
        <View className="mt-6 gap-2 px-6">
          <Text variant="muted" className="text-xs uppercase tracking-widest">
            List
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {lists.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => setSelectedListId(l.id)}
                className={`rounded-full border px-4 py-2 ${effectiveListId === l.id ? "border-primary bg-primary" : "border-border bg-card"}`}
              >
                <Text
                  className={
                    effectiveListId === l.id
                      ? "text-primary-foreground"
                      : "text-foreground"
                  }
                >
                  {l.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {stripReady ? (
        <DayStrip
          className="mt-6"
          dates={strip.dates}
          todayIndex={strip.todayIndex}
          selected={selectedDate}
          onSelect={setSelectedDate}
        />
      ) : (
        <View className="mt-6 h-18 flex-row items-center gap-2 px-6 py-2">
          <Skeleton className="h-14 w-12 rounded-xl" />
        </View>
      )}

      <View className="mt-6 gap-2 px-6">
        <Text variant="muted" className="text-xs uppercase tracking-widest">
          Meal
        </Text>
        <View className="flex-row gap-2">
          {SLOT_ORDER.map((m) => (
            <Pressable
              key={m}
              onPress={() => setSelectedMeal(m)}
              className={`flex-1 items-center rounded-full border py-2.5 ${selectedMeal === m ? "border-primary bg-primary" : "border-border bg-card"}`}
            >
              <Text
                className={`capitalize ${selectedMeal === m ? "font-semibold text-primary-foreground" : "text-foreground"}`}
              >
                {SLOT_LABEL[m]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-6 flex-row items-center justify-between px-6">
        <Text variant="muted" className="text-xs uppercase tracking-widest">
          Servings
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => setServings((s) => Math.max(1, s - 1))}
            hitSlop={8}
            className="size-9 items-center justify-center rounded-full border border-border bg-card"
          >
            <SymbolView name={MINUS_ICON} tintColor={mutedColor} size={16} />
          </Pressable>
          <Text className="w-6 text-center text-base font-semibold">
            {servings}
          </Text>
          <Pressable
            onPress={() => setServings((s) => Math.min(12, s + 1))}
            hitSlop={8}
            className="size-9 items-center justify-center rounded-full border border-border bg-card"
          >
            <SymbolView name={PLUS_ICON} tintColor={mutedColor} size={16} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text variant="small" className="mt-6 px-6 text-destructive">
          {error}
        </Text>
      ) : null}

      <View className="mt-6 gap-2 px-6">
        <Button
          size="lg"
          onPress={() => void onAdd()}
          disabled={saving || (!pending && !effectiveListId)}
        >
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Text>{pending ? "Save & plan" : "Add to plan"}</Text>
          )}
        </Button>
        <Button variant="ghost" onPress={() => router.back()} disabled={saving}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </>
  );
}
