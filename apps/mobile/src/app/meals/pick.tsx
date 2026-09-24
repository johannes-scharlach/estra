import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";

import type { Variant } from "@/db/schema";
import { setPlannedMeal } from "@/db/planned-meals";
import { RecipeBrowser } from "@/features/cookbook/recipe-browser";
import { mealLabel } from "@/features/meals/variant-meals";
import type { MealSlot } from "@/features/meals/slots";
import { useActiveList } from "@/features/onboarding/access";

export default function PickFromCookbook() {
  const { slot, date } = useLocalSearchParams<{ slot: MealSlot; date: string }>();
  const router = useRouter();
  const list = useActiveList();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(variant: Variant) {
    if (!list || !slot || !date || !variant.recipe_id || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await setPlannedMeal({ listId: list.id, slotDate: date, meal: slot, recipeId: variant.recipe_id, variantId: variant.id });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not plan meal.");
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: mealLabel({ slot_date: date, meal: slot }), headerBackButtonDisplayMode: "minimal" }} />
      <RecipeBrowser
        target={{ date, slot }}
        disabled={saving}
        error={error}
        onSelect={(variant) => void pick(variant)}
        onImport={() => router.replace({ pathname: "/meals/import", params: { date, slot } })}
      />
    </>
  );
}
