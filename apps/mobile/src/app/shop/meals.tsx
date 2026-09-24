import { useQuery } from "@powersync/react";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import type { PlannedMeal } from "@/db/schema";
import { mealLabel } from "@/features/meals/variant-meals";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";

type Meal = PlannedMeal & { display_name: string | null };

export default function ShopMeals() {
  const list = useActiveList();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const muted = useResolveClassNames("text-muted-foreground").color;
  const { data: meals, isLoading } = useQuery<Meal>(
    `SELECT pm.*, COALESCE(pm.name, v.name) AS display_name
       FROM planned_meals pm LEFT JOIN variants v ON v.id = pm.variant_id
      WHERE pm.list_id = ? AND pm.slot_date >= ?
      ORDER BY pm.slot_date, CASE pm.meal WHEN 'lunch' THEN 0 WHEN 'dinner' THEN 1 ELSE 2 END`,
    [list?.id ?? "", today],
  );
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <Text variant="muted">Go through your planned meals and choose what to buy for each one.</Text>
      {isLoading ? <ActivityIndicator /> : meals.length === 0 ? <Text>No upcoming meals. Plan a meal to choose its ingredients here.</Text> : null}
      {meals.map((meal) => (
        <Link
          key={meal.id}
          href={{ pathname: meal.variant_id ? "/meals/shopping" : "/meals/written", params: { id: meal.id } }}
          asChild
        >
          <Pressable accessibilityRole="button" className="min-h-16 flex-row items-center gap-3 border-b border-border py-3">
            <View className="flex-1 gap-1">
              <Text className="font-semibold">{meal.display_name ?? "Meal"}</Text>
              <Text variant="muted">{mealLabel(meal)}</Text>
              {!meal.variant_id ? <Text variant="muted">Open meal for shopping help</Text> : null}
            </View>
            <SymbolView name={{ ios: "chevron.right", android: "chevron_right" }} size={16} tintColor={muted} />
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
