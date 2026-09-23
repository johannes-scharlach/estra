import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { RecipeResult } from "./recipe-results";

export function RecipeResultView({ result }: { result: RecipeResult }) {
  return (
    <View className="mx-5 mt-3 gap-2 rounded-xl border border-border bg-card p-3">
      <Link
        href={{
          pathname: "/variant/[id]",
          params: {
            id: result.variantId,
            plannedMealId: result.plannedMeal?.id,
          },
        }}
        asChild
      >
        <Pressable accessibilityRole="link" className="gap-1 active:opacity-60">
          <Text variant="muted" className="text-xs">
            New version
          </Text>
          <Text className="font-semibold text-primary">{result.name} →</Text>
        </Pressable>
      </Link>
      {result.plannedMeal ? (
        <Text className="text-sm">
          Updated {result.plannedMeal.date} {result.plannedMeal.meal}
        </Text>
      ) : null}
      {result.shopping ? (
        <View className="gap-1">
          {(
            [
              ["Added", result.shopping.added],
              ["Removed", result.shopping.removed],
              ["Updated amounts", result.shopping.updated],
              ["Kept bought", result.shopping.keptBought],
            ] as const
          )
            .filter(([, items]) => items.length)
            .map(([label, items]) => (
              <Text key={label} selectable variant="muted" className="text-sm">
                {label}: {items.join(", ")}
              </Text>
            ))}
        </View>
      ) : null}
    </View>
  );
}
