import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import { movePlannedMeal } from "@/db/planned-meals";
import type { PlannedMeal, Variant } from "@/db/schema";
import { DayStrip } from "@/features/meals/day-strip";
import {
  dateKey,
  SLOT_LABEL,
  SLOT_ORDER,
  stripDates,
  type MealSlot,
} from "@/features/meals/slots";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";

export default function MoveMealSheet() {
  const { listId, date, slot, variantId } = useLocalSearchParams<{
    listId: string;
    date: string;
    slot: MealSlot;
    variantId: string;
  }>();
  const router = useRouter();
  const importJobs = useImportJobs();
  const strip = useMemo(() => stripDates(0), []);
  const todayKey = dateKey(strip.dates[0] ?? new Date());
  const [destinationDate, setDestinationDate] = useState(
    date >= todayKey ? date : todayKey,
  );
  const [destinationSlot, setDestinationSlot] = useState<MealSlot>(slot);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: meals } = useQuery<PlannedMeal>(
    listId
      ? "SELECT * FROM planned_meals WHERE list_id = ?"
      : "SELECT * FROM planned_meals WHERE 0",
    listId ? [listId] : [],
  );
  const { data: variants } = useQuery<Variant>(
    "SELECT * FROM variants ORDER BY created_at DESC",
  );
  const destination = meals.find(
    (meal) =>
      meal.slot_date === destinationDate && meal.meal === destinationSlot,
  );
  const destinationName = destination?.variant_id
    ? variants.find((variant) => variant.id === destination.variant_id)?.name
    : null;
  const isSame = destinationDate === date && destinationSlot === slot;
  const hasImport = listId
    ? !!importJobs.getForSlot({
        listId,
        date: destinationDate,
        slot: destinationSlot,
      })
    : false;

  async function confirm() {
    if (
      !listId ||
      !date ||
      !slot ||
      !variantId ||
      saving ||
      isSame ||
      hasImport
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await movePlannedMeal(
        listId,
        { date, slot, variantId },
        { date: destinationDate, slot: destinationSlot },
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (caught) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(caught instanceof Error ? caught.message : "Could not move meal.");
      setSaving(false);
    }
  }

  return (
    <View collapsable={false}>
      <View className="flex-row items-center justify-between gap-4 px-6 pt-4">
        <Text className="flex-1 text-lg font-semibold">Move meal</Text>
        <CloseButton onPress={() => router.back()} disabled={saving} />
      </View>

      <DayStrip
        className="mt-6"
        dates={strip.dates}
        todayIndex={strip.todayIndex}
        selected={destinationDate}
        onSelect={setDestinationDate}
      />

      <View className="mt-6 gap-2 px-6">
        <Text variant="muted" className="text-xs uppercase tracking-widest">
          Meal
        </Text>
        <View className="flex-row gap-2">
          {SLOT_ORDER.map((mealSlot) => (
            <Pressable
              key={mealSlot}
              onPress={() => setDestinationSlot(mealSlot)}
              className={`flex-1 items-center rounded-full border py-2.5 ${destinationSlot === mealSlot ? "border-primary bg-primary" : "border-border bg-card"}`}
            >
              <Text
                className={
                  destinationSlot === mealSlot
                    ? "font-semibold text-primary-foreground"
                    : "text-foreground"
                }
              >
                {SLOT_LABEL[mealSlot]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-6 h-16 justify-center px-6">
        {isSame ? (
          <Text variant="muted">Choose a different date or meal slot.</Text>
        ) : hasImport ? (
          <Text variant="muted">A meal is currently being imported here.</Text>
        ) : destination ? (
          <View className="gap-1">
            <Text className="font-medium">This slot already has a meal</Text>
            <Text variant="muted">
              {destinationName ?? "Planned meal"} will move to the original slot.
            </Text>
          </View>
        ) : (
          <Text variant="muted">This slot is free.</Text>
        )}
      </View>

      {error ? (
        <Text selectable className="mt-4 px-6 text-destructive">
          {error}
        </Text>
      ) : null}

      <SheetActions>
        <PrimaryAction
          label={
            saving
              ? "Moving…"
              : destination && !isSame
                ? "Swap meals"
                : "Move meal"
          }
          disabled={saving || isSame || hasImport}
          onPress={() => void confirm()}
        />
      </SheetActions>
    </View>
  );
}
