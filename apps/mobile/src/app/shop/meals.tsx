import { parseMealSwaps } from "@estra/meals";
import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { parseAtHome } from "@/db/meal-shopping";
import type { ListItem } from "@/db/schema";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { parseIngredientLines } from "@/db/variants";
import {
  shoppingProgress,
  shoppingReview,
} from "@/features/meals/shopping-review";
import { startShoppingChat } from "@/features/meals/start-shopping-chat";
import { mealLabel } from "@/features/meals/variant-meals";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";


export default function ShopMeals() {
  const list = useActiveList();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const upcoming = [list?.id ?? "", today];
  const { data: meals, isLoading } = useQuery<
    ShoppingMeal & { ingredient_lines: string | null }
  >(
    `SELECT m.*, v.ingredient_lines FROM (${MEALS_WITH_SHOPPING}
      WHERE pm.list_id = ? AND pm.slot_date >= ?) m
      LEFT JOIN variants v ON v.id = m.variant_id
      ORDER BY m.slot_date, CASE m.meal WHEN 'lunch' THEN 0 WHEN 'dinner' THEN 1 ELSE 2 END`,
    upcoming,
  );
  const { data: items } = useQuery<ListItem>(
    `SELECT i.* FROM list_items i JOIN planned_meals pm ON pm.id = i.planned_meal_id
      WHERE pm.list_id = ? AND pm.slot_date >= ?`,
    upcoming,
  );
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {isLoading ? null : meals.length === 0 ? (
        <Text className="px-6 pt-3">
          No upcoming meals. Plan a meal to choose what to buy here.
        </Text>
      ) : (
        // Meals stay in date order: the badge, not sorting, shows what's open.
        meals.map((meal, index) => (
          <MealRow
            key={meal.id}
            meal={meal}
            items={items.filter((item) => item.planned_meal_id === meal.id)}
            last={index === meals.length - 1}
          />
        ))
      )}
    </ScrollView>
  );
}

/**
 * Laid out like a Podcasts episode: the slot above, the title at full width,
 * the progress below it, and an unread dot while there is something to decide.
 */
function MealRow({
  meal,
  items,
  last,
}: {
  meal: ShoppingMeal & { ingredient_lines: string | null };
  items: ListItem[];
  /** Separators sit between rows, never after the last one. */
  last: boolean;
}) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const checked = !!meal.shopping_reviewed;
  let progress: string;
  if (!meal.variant_id) {
    progress = items.length
      ? `${items.length} on the list`
      : "No ingredient list yet";
  } else if (!meal.ingredient_lines) {
    progress = "Recipe still syncing";
  } else {
    try {
      progress = shoppingProgress(
        shoppingReview(
          parseIngredientLines(meal.ingredient_lines),
          items,
          parseMealSwaps(meal.ingredient_swaps),
          parseAtHome(meal.ingredients_at_home),
        ),
      );
    } catch {
      progress = "Recipe still syncing";
    }
  }

  return (
    // A plain iOS list: separators start at the text and run to the screen edge.
    <Pressable
      accessibilityRole="button"
      className={`ml-6 flex-row items-center gap-3 py-3 pr-6 ${last ? "" : "border-b border-border"}`}
      onPress={() => {
        if (!meal.variant_id && !meal.shopping_reviewed) {
          startShoppingChat(meal);
        } else {
          router.push({
            pathname: meal.variant_id ? "/meals/shopping" : "/meals/written",
            params: { id: meal.id },
          });
        }
      }}
    >
      <View className="flex-1 gap-1">
        <Text variant="muted" className="text-xs font-semibold uppercase">
          {mealLabel(meal)}
        </Text>
        <View>
          {checked ? null : (
            // Mail's unread dot, centred on the title's first line.
            <View className="absolute -left-4 top-0 h-6 justify-center">
              <View className="size-2.5 rounded-full bg-primary" />
            </View>
          )}
          <Text numberOfLines={2} className="font-medium">
            {meal.display_name ?? "Meal"}
          </Text>
        </View>
        <Text variant="muted">{progress}</Text>
      </View>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right" }}
        size={14}
        tintColor={muted}
      />
    </Pressable>
  );
}
