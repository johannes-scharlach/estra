import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import type { List, Variant } from "@/db/schema";
import { plannedMealId, setPlannedMeal } from "@/db/planned-meals";
import { useAuth } from "@/db/provider";
import { saveAndPlanMessage } from "@/features/chat/compose";
import { queueMessage } from "@/features/chat/message-queue";
import { Action, PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";
import { DayStrip } from "@/features/meals/day-strip";
import { toEaters } from "@/features/meals/eaters";
import {
  EXTRA_PORTIONS_ERROR,
  EatersPicker,
} from "@/features/meals/eaters-picker";
import {
  dateKey,
  SLOT_LABEL,
  SLOT_ORDER,
  stripDates,
  type MealSlot,
} from "@/features/meals/slots";
import { useActiveList } from "@/features/onboarding/access";

type PersonRow = { id: string; name: string; user_id: string | null };

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so picker state is always fresh.
 *
 *  Two modes: with a variant id it plans that recipe; with `dish` instead
 *  (from a chat Sketch's Save & plan) it is a pending form — nothing runs
 *  behind the sheet, and confirming sends one chat message stating exactly
 *  what was agreed; the assistant does the save + plan (two tool calls),
 *  sizing the recipe it writes for the eaters and extra chosen here. */
export default function PlanVariantSheet() {
  const { id, dish } = useLocalSearchParams<{ id?: string; dish?: string }>();
  const router = useRouter();
  const { session } = useAuth();

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
  // null until the user touches the list: everyone, even as people load.
  const [pickedEaterIds, setPickedEaterIds] = useState<string[] | null>(null);
  const [extraPortions, setExtraPortions] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strip = useMemo(() => stripDates(0), []);
  const activeList = useActiveList();
  const effectiveListId = selectedListId ?? activeList?.id ?? null;

  const { data: peopleRows } = useQuery<PersonRow>(
    "SELECT id, name, user_id FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [effectiveListId ?? ""],
  );
  const people = useMemo(
    () => toEaters(peopleRows, session?.user.id),
    [peopleRows, session],
  );
  const eaterIds = pickedEaterIds ?? people.map((p) => p.id);

  async function onAdd(reviewIngredients = false) {
    if (extraPortions === null) {
      setError(EXTRA_PORTIONS_ERROR);
      return;
    }
    if (pending) {
      // The commit: one honest message back on the chat screen.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queueMessage({
        messageId: Crypto.randomUUID(),
        text: saveAndPlanMessage({
          day: selectedDate,
          meal: selectedMeal,
          people,
          eaterIds,
          extraPortions,
        }),
        attachments: [],
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
        eaterIds,
        extraPortions,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (reviewIngredients) {
        router.replace({ pathname: "/meals/shopping", params: { id: plannedMealId(effectiveListId, selectedDate, selectedMeal) } });
      } else {
        router.back();
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : "Could not add to plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Keep a native wrapper so formSheet doesn't mistake the horizontal
    // DayStrip for its main ScrollView and resize it to the sheet's height.
    <View collapsable={false}>
      <View className="gap-1 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">
            {pending ? "Save & plan" : "Add to plan"}
          </Text>
          <CloseButton onPress={() => router.back()} disabled={saving} />
        </View>
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
                onPress={() => {
                  setSelectedListId(l.id);
                  setPickedEaterIds(null);
                }}
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

      <DayStrip
        className="mt-6"
        dates={strip.dates}
        todayIndex={strip.todayIndex}
        selected={selectedDate}
        onSelect={setSelectedDate}
      />

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

      <EatersPicker
        people={people}
        eaterIds={eaterIds}
        extraPortions={extraPortions ?? 0}
        onEaterIdsChange={(ids) => {
          setPickedEaterIds(ids);
          setError(null);
        }}
        onExtraPortionsChange={(value) => {
          setExtraPortions(value);
          setError(null);
        }}
      />

      {error ? (
        <Text variant="small" className="mt-6 px-6 text-destructive">
          {error}
        </Text>
      ) : null}

      <SheetActions>
        <PrimaryAction
          label={saving ? "Adding…" : pending ? "Save & plan" : "Add to plan"}
          onPress={() => void onAdd()}
          disabled={saving || (!pending && !effectiveListId)}
        />
        {!pending ? (
          <Action label="Plan & choose ingredients" onPress={() => void onAdd(true)} disabled={saving || !effectiveListId} />
        ) : null}
      </SheetActions>
    </View>
  );
}
