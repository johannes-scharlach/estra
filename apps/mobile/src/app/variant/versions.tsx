import { useQuery } from "@powersync/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { PlannedMeal, Variant } from "@/db/schema";
import { dateKey, type MealSlot } from "@/features/meals/slots";
import { mealLabel } from "@/features/meals/variant-meals";
import { setPlannedMeal } from "@/db/planned-meals";
import { useActiveList } from "@/features/onboarding/access";

function sizedFor(
  variant: Variant,
  people: { id: string; name: string }[],
): string {
  try {
    const sizing = JSON.parse(variant.sized_for ?? "null") as {
      eater_ids: string[];
      extra_portions: number;
    } | null;
    if (sizing && Array.isArray(sizing.eater_ids)) {
      const names = sizing.eater_ids.map(
        (id) =>
          people.find((person) => person.id === id)?.name ??
          "Former household member",
      );
      return `Sized for ${names.join(", ") || "extra portions only"}${sizing.extra_portions ? ` +${sizing.extra_portions} extra` : ""}`;
    }
  } catch {
    /* Fall back to the recipe's own yield text. */
  }
  return variant.recipe_yield ?? "Sizing not recorded";
}

export default function RecipeVariants() {
  const { recipeId, id, date, slot } = useLocalSearchParams<{
    recipeId: string;
    id?: string;
    date?: string;
    slot?: MealSlot;
  }>();
  const router = useRouter();
  const list = useActiveList();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function select(variant: Variant) {
    if (!date || !slot) {
      router.push({ pathname: "/variant/[id]", params: { id: variant.id } });
      return;
    }
    if (!list || !variant.recipe_id || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await setPlannedMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        recipeId: variant.recipe_id,
        variantId: variant.id,
      });
      router.dismissTo("/(tabs)/meals");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not plan meal.",
      );
      busy.current = false;
      setSaving(false);
    }
  }
  const { data: variants, isLoading } = useQuery<Variant>(
    "SELECT * FROM variants WHERE recipe_id = ? ORDER BY created_at DESC, id",
    [recipeId ?? ""],
  );
  const { data: people } = useQuery<{ id: string; name: string }>(
    "SELECT id, name FROM household_people",
  );
  const { data: meals } = useQuery<PlannedMeal>(
    "SELECT * FROM planned_meals WHERE recipe_id = ? AND slot_date >= ? ORDER BY slot_date, meal",
    [recipeId ?? "", dateKey(new Date())],
  );
  return (
    <>
      <Stack.Screen
        options={{
          title:
            date && slot
              ? mealLabel({ slot_date: date, meal: slot })
              : "Variants",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <FlatList
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 32 }}
        data={variants}
        ListHeaderComponent={
          error ? <Text className="p-6 text-destructive">{error}</Text> : null
        }
        keyExtractor={(variant) => variant.id}
        ListEmptyComponent={
          <Text variant="muted" className="p-6">
            {isLoading ? "Loading variants…" : "No variants found."}
          </Text>
        }
        renderItem={({ item: variant }) => {
          const planned = meals.filter(
            (meal) => meal.variant_id === variant.id,
          );
          return (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void select(variant)}
              className="gap-1 border-b border-border/40 px-6 py-4 active:bg-accent"
            >
              <View className="flex-row items-baseline gap-2">
                <Text className="flex-1 text-base font-semibold">
                  {variant.name}
                </Text>
                {variant.id === id ? (
                  <Text className="text-sm text-primary">Viewing</Text>
                ) : null}
              </View>
              <Text variant="muted" className="text-sm">
                {variant.created_at
                  ? new Date(variant.created_at).toLocaleDateString()
                  : ""}{" "}
                · {sizedFor(variant, people)}
              </Text>
              {variant.description ? (
                <Text variant="muted" numberOfLines={2}>
                  {variant.description}
                </Text>
              ) : null}
              {variant.total_time ? (
                <Text variant="muted" className="text-sm">
                  {variant.total_time}
                </Text>
              ) : null}
              {planned.map((meal) => (
                <Text key={meal.id} className="text-sm text-primary">
                  Planned: {mealLabel(meal)}
                </Text>
              ))}
            </Pressable>
          );
        }}
      />
    </>
  );
}
