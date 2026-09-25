import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { startShoppingChat } from "@/features/meals/start-shopping-chat";
import { mealLabel } from "@/features/meals/variant-meals";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";

export default function ShopMeals() {
  const list = useActiveList();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const muted = useResolveClassNames("text-muted-foreground").color;
  const { data: meals, isLoading } = useQuery<ShoppingMeal>(
    `${MEALS_WITH_SHOPPING}
      WHERE pm.list_id = ? AND pm.slot_date >= ?
      ORDER BY pm.slot_date, CASE pm.meal WHEN 'lunch' THEN 0 WHEN 'dinner' THEN 1 ELSE 2 END`,
    [list?.id ?? "", today],
  );
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 24,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
    >
      <Text variant="muted">Choose what to buy for each meal.</Text>
      {!isLoading && meals.length === 0 ? (
        <Text>No upcoming meals. Plan a meal to choose what to buy here.</Text>
      ) : null}
      {meals.map((meal) => (
        <Pressable
          key={meal.id}
          accessibilityRole="button"
          className="min-h-16 flex-row items-center gap-3 border-b border-border py-3"
          onPress={() => {
            if (!meal.variant_id && !meal.shopping_reviewed) {
              startShoppingChat(meal);
            } else {
              router.push({
                pathname: meal.variant_id
                  ? "/meals/shopping"
                  : "/meals/written",
                params: { id: meal.id },
              });
            }
          }}
        >
          <View className="flex-1 gap-1">
            <Text className="font-semibold">{meal.display_name ?? "Meal"}</Text>
            <Text variant="muted">{mealLabel(meal)}</Text>
            <Text variant="muted">
              {meal.shopping_reviewed ? "Reviewed" : "Choose what to buy"}
            </Text>
          </View>
          <SymbolView
            name={{ ios: "chevron.right", android: "chevron_right" }}
            size={16}
            tintColor={muted}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}
