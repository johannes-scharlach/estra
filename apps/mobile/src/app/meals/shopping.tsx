import { Button, Host, Text as NativeText } from "@expo/ui";
import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { saveMealShoppingReview } from "@/db/meal-shopping";
import type { ListItem, PlannedMeal } from "@/db/schema";
import { parseIngredientLines } from "@/db/variants";
import {
  optionsForLine,
  shoppingReview,
} from "@/features/meals/shopping-review";
import { mealLabel } from "@/features/meals/variant-meals";

type Meal = PlannedMeal & {
  recipe_name: string | null;
  ingredient_lines: string | null;
};

export default function MealShopping() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meals, isLoading } = useQuery<Meal>(
    `SELECT pm.*, v.name AS recipe_name, v.ingredient_lines
       FROM planned_meals pm LEFT JOIN variants v ON v.id = pm.variant_id WHERE pm.id = ?`,
    [id ?? ""],
  );
  const { data: items, isLoading: itemsLoading } = useQuery<ListItem>(
    "SELECT * FROM list_items WHERE planned_meal_id = ? ORDER BY created_at, id",
    [id ?? ""],
  );
  const meal = meals[0];
  const parsed = useMemo(() => {
    try {
      return meal?.ingredient_lines
        ? parseIngredientLines(meal.ingredient_lines)
        : null;
    } catch {
      return null;
    }
  }, [meal]);

  if (isLoading || itemsLoading)
    return <ActivityIndicator className="flex-1" />;
  if (!meal || !parsed) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24 }}
      >
        <Text>
          {meal
            ? "The recipe hasn't synced yet. Open its ingredients again shortly."
            : "This meal is no longer planned."}
        </Text>
      </ScrollView>
    );
  }
  return (
    <IngredientReview
      key={`${meal.content_id}:${meal.variant_id}`}
      meal={meal}
      lines={parsed}
      items={items}
    />
  );
}

function IngredientReview({
  meal,
  lines,
  items,
}: {
  meal: Meal;
  lines: ReturnType<typeof parseIngredientLines>;
  items: ListItem[];
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const review = shoppingReview(lines, items);
  const alreadyReviewed = meal.shopping_reviewed_variant_id === meal.variant_id;
  const [selected, setSelected] = useState(
    () =>
      new Set(
        review
          .filter((entry) => entry.item || (!alreadyReviewed && !entry.atHome))
          .map((entry) => entry.index),
      ),
  );
  const [optionIndexes, setOptionIndexes] = useState(
    () =>
      Object.fromEntries(
        review.map((entry) => [entry.index, entry.optionIndex]),
      ) as Record<number, number>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toAdd = review.filter(
    (entry) => selected.has(entry.index) && !entry.item,
  );

  async function save() {
    if (saving || !meal.list_id || !meal.content_id || !meal.variant_id) return;
    setSaving(true);
    setError(null);
    try {
      await saveMealShoppingReview({
        listId: meal.list_id,
        mealId: meal.id,
        contentId: meal.content_id,
        variantId: meal.variant_id,
        selections: review
          .filter((entry) => selected.has(entry.index))
          .map((entry) => ({
            lineIndex: entry.index,
            optionIndex: optionIndexes[entry.index] ?? entry.optionIndex,
          })),
      });
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save shopping choices. Try again.",
      );
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 24,
        paddingBottom: insets.bottom + 24,
        gap: 24,
      }}
    >
      <View className="gap-1">
        <Text variant="h3">{meal.recipe_name}</Text>
        <Text variant="muted">{mealLabel(meal)}</Text>
        <Text variant="muted">
          Choose what to buy, and pick a swap if you prefer an alternative.
          Changes apply to this meal’s shopping items.
        </Text>
      </View>
      {[false, true].map((atHome) => {
        const entries = review.filter((entry) => entry.atHome === atHome);
        return (
          <View key={String(atHome)} className="gap-2">
            <Text className="font-semibold">
              {atHome ? "Probably at home" : "Likely purchases"}
            </Text>
            {entries.length === 0 ? (
              <Text variant="muted">No ingredients in this section.</Text>
            ) : null}
            {entries.map(({ index, line, item, optionIndex }) => {
              const checked = selected.has(index);
              const options = optionsForLine(line);
              const chosenIndex = optionIndexes[index] ?? optionIndex;
              const chosen = options[chosenIndex] ?? line;
              return (
                <View key={index} className="border-b border-border py-3">
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked,
                      disabled: saving || item?.status === "purchased",
                    }}
                    accessibilityLabel={[
                      chosen.qty_text,
                      chosen.item_name,
                      item
                        ? item.status === "purchased"
                          ? "Bought"
                          : "Already on the list"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={saving || item?.status === "purchased"}
                    onPress={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                    className="min-h-11 flex-row items-center gap-3"
                  >
                    <SymbolView
                      name={
                        checked
                          ? {
                              ios: "checkmark.circle.fill",
                              android: "check_circle",
                            }
                          : { ios: "circle", android: "radio_button_unchecked" }
                      }
                      tintColor={
                        checked && item?.status !== "purchased"
                          ? primary
                          : muted
                      }
                      size={24}
                    />
                    <View className="flex-1 gap-0.5">
                      <Text>
                        {[chosen.qty_text, chosen.item_name]
                          .filter(Boolean)
                          .join(" ")}
                      </Text>
                      {chosen.prep_note ? (
                        <Text variant="muted">{chosen.prep_note}</Text>
                      ) : null}
                      {item ? (
                        <Text variant="muted">
                          {item.status === "purchased"
                            ? "Bought"
                            : "Already on the list"}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {options.length > 1 ? (
                    <View className="ml-9 mt-2 flex-row flex-wrap items-center gap-2">
                      {options.map((option, choice) => {
                        const active = chosenIndex === choice;
                        return (
                          <Pressable
                            key={`${index}:${option.item_name}`}
                            accessibilityRole="radio"
                            accessibilityState={{
                              checked: active,
                              disabled: saving || item?.status === "purchased",
                            }}
                            disabled={saving || item?.status === "purchased"}
                            onPress={() => {
                              setOptionIndexes((current) => ({
                                ...current,
                                [index]: choice,
                              }));
                              setSelected((current) =>
                                new Set(current).add(index),
                              );
                            }}
                            className={
                              active
                                ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5"
                                : "rounded-full border border-border px-3 py-1.5"
                            }
                          >
                            <Text
                              className={
                                active
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }
                            >
                              {choice === 0
                                ? `Original · ${option.item_name}`
                                : option.item_name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
      <View className="gap-3">
        {error ? (
          <Text selectable className="text-destructive">
            {error}
          </Text>
        ) : null}
        <Host matchContents={{ vertical: true }} ignoreSafeArea="all">
          <Button disabled={saving} onPress={() => void save()}>
            <NativeText
              style={{ width: "100%", paddingVertical: 12 }}
              textStyle={{ textAlign: "center" }}
            >
              {saving
                ? "Saving…"
                : toAdd.length
                  ? `Add ${toAdd.length} ${toAdd.length === 1 ? "item" : "items"}`
                  : "Save choices"}
            </NativeText>
          </Button>
        </Host>
      </View>
    </ScrollView>
  );
}
