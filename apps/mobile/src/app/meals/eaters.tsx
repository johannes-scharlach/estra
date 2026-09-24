import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";
import { Text } from "@/components/ui/text";
import { updatePlannedMealEaters } from "@/db/planned-meals";
import { useAuth } from "@/db/provider";
import {
  parseEaterIds,
  parseExtraPortions,
  toEaters,
} from "@/features/meals/eaters";
import {
  EXTRA_PORTIONS_ERROR,
  EatersPicker,
} from "@/features/meals/eaters-picker";
import type { MealSlot } from "@/features/meals/slots";
import { mealLabel } from "@/features/meals/variant-meals";

type PersonRow = { id: string; name: string; user_id: string | null };

/** Edits who is eating a planned meal and the extra. The recipe and its
 *  shopping items are not touched; the sheet says so. */
export default function EatersSheet() {
  const params = useLocalSearchParams<{
    listId: string;
    date: string;
    slot: MealSlot;
    variantId: string;
    eaterIds: string;
    extraPortions: string;
  }>();
  const { listId, date, slot, variantId } = params;
  const router = useRouter();
  const { session } = useAuth();
  const { data: rows } = useQuery<PersonRow>(
    "SELECT id, name, user_id FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [listId ?? ""],
  );
  const people = useMemo(
    () => toEaters(rows, session?.user.id),
    [rows, session],
  );

  const [eaterIds, setEaterIds] = useState(() =>
    parseEaterIds(params.eaterIds),
  );
  const initialExtra = parseExtraPortions(params.extraPortions ?? "") ?? 0;
  const [extraPortions, setExtraPortions] = useState<number | null>(
    initialExtra,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (extraPortions === null) {
      setError(EXTRA_PORTIONS_ERROR);
      return;
    }
    if (!listId || !date || !slot || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlannedMealEaters(
        listId,
        date,
        slot,
        variantId || null,
        eaterIds,
        extraPortions,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (caught) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        caught instanceof Error ? caught.message : "Could not update the meal.",
      );
      setSaving(false);
    }
  }

  return (
    <View collapsable={false}>
      <View className="flex-row items-center justify-between gap-4 px-6 pt-4">
        <Text className="flex-1 text-lg font-semibold">
          {mealLabel({ slot_date: date ?? null, meal: slot ?? null })}
        </Text>
        <CloseButton onPress={() => router.back()} disabled={saving} />
      </View>

      <EatersPicker
        people={people}
        eaterIds={eaterIds}
        extraPortions={extraPortions ?? initialExtra}
        onEaterIdsChange={(ids) => {
          setEaterIds(ids);
          setError(null);
        }}
        onExtraPortionsChange={(value) => {
          setExtraPortions(value);
          setError(null);
        }}
      />

      {error ? (
        <Text selectable className="mt-4 px-6 text-destructive">
          {error}
        </Text>
      ) : null}

      <SheetActions>
        <PrimaryAction
          label={saving ? "Applying…" : "Apply"}
          disabled={saving}
          onPress={() => void save()}
        />
      </SheetActions>
    </View>
  );
}
