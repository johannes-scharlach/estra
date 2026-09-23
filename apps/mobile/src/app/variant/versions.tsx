import { useQuery } from "@powersync/react";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { PlannedMeal, Variant } from "@/db/schema";
import { dateKey } from "@/features/meals/slots";
import { mealLabel } from "@/features/meals/variant-meals";

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

export default function VariantVersions() {
  const { recipeId, id } = useLocalSearchParams<{
    recipeId: string;
    id?: string;
  }>();
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
        options={{ title: "Variants", headerBackButtonDisplayMode: "minimal" }}
      />
      <FlatList
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 32 }}
        data={variants}
        keyExtractor={(variant) => variant.id}
        ListEmptyComponent={
          <Text variant="muted" className="p-6">
            {isLoading ? "Loading versions…" : "No versions found."}
          </Text>
        }
        renderItem={({ item: variant }) => {
          const planned = meals.filter(
            (meal) => meal.variant_id === variant.id,
          );
          return (
            <Link
              href={{ pathname: "/variant/[id]", params: { id: variant.id } }}
              asChild
            >
              <Pressable className="gap-1 border-b border-border/40 px-6 py-4 active:bg-accent">
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
            </Link>
          );
        }}
      />
    </>
  );
}
