import { useQuery } from "@powersync/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { ListItem, PlannedMeal } from "@/db/schema";
import { startShoppingChat } from "@/features/meals/start-shopping-chat";
import { mealIsPast, mealLabel } from "@/features/meals/variant-meals";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";

export default function WrittenMeal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const list = useActiveList();
  const today = useToday();
  const { data: meals, isLoading } = useQuery<PlannedMeal>(
    "SELECT * FROM planned_meals WHERE id = ? AND list_id = ?",
    [id ?? "", list?.id ?? ""],
  );
  const { data: items } = useQuery<ListItem>(
    "SELECT * FROM list_items WHERE planned_meal_id = ? AND list_id = ? ORDER BY created_at, id",
    [id ?? "", list?.id ?? ""],
  );
  const meal = meals[0];
  const pastMeal = mealIsPast(meal?.slot_date ?? null, today);
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 p-6"
    >
      <Stack.Screen options={{ title: meal ? mealLabel(meal) : "Meal" }} />
      {!meal ? (
        <Text variant="muted">
          {isLoading ? "Loading meal…" : "This meal is no longer planned."}
        </Text>
      ) : meal.variant_id ? (
        <Button
          onPress={() =>
            router.replace({
              pathname: "/variant/[id]",
              params: { id: meal.variant_id!, plannedMealId: meal.id },
            })
          }
        >
          <Text>Open planned recipe</Text>
        </Button>
      ) : (
        <>
          {pastMeal ? (
            <View className="gap-0.5 rounded-2xl bg-secondary p-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Past meal
              </Text>
              <Text className="font-semibold">{mealLabel(meal)}</Text>
            </View>
          ) : null}
          <Text className="text-2xl font-semibold">{meal.name}</Text>
          {pastMeal ? (
            <Button
              onPress={() =>
                router.push({
                  pathname: "/meals/move",
                  params: {
                    listId: meal.list_id!,
                    date: meal.slot_date!,
                    slot: meal.meal!,
                    variantId: "",
                    mode: "repeat",
                  },
                })
              }
            >
              <Text>Plan again</Text>
            </Button>
          ) : (
            <Button
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/meals/write",
                  params: {
                    date: meal.slot_date!,
                    slot: meal.meal!,
                    name: meal.name!,
                  },
                })
              }
            >
              <Text>Edit meal</Text>
            </Button>
          )}
          <View className="gap-3">
            {items.length ? (
              <Text className="font-semibold">Shopping for this meal</Text>
            ) : null}
            {items.map((item) => (
              <Text
                key={item.id}
                className={
                  item.status === "purchased"
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }
              >
                {[item.name, item.spec].filter(Boolean).join(" · ")}
              </Text>
            ))}
            {!pastMeal ? (
              <Button variant="ghost" onPress={() => startShoppingChat(meal)}>
                <Text>
                  {items.length ? "Add more items" : "Choose what to buy"}
                </Text>
              </Button>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
