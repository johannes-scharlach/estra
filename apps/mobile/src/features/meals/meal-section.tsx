import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

type Recipe = { id: string; name: string };

type Props = {
  title: string;
  /** Planned recipe, or null when the slot is still open. */
  recipe: Recipe | null;
  contenders: Recipe[];
  onPlan: (recipe: Recipe) => void;
  /** Planned card's "..." — opens the slot action sheet. */
  onMenu: (recipe: Recipe) => void;
  /** Open slot's × — hides the slot behind "+ Add …". */
  onHide: () => void;
  onView: (recipe: Recipe) => void;
  onImport: () => void;
  onCookbook: () => void;
};

const FOOD_ICON = {
  ios: "fork.knife",
  android: "restaurant",
  web: "restaurant",
} as const;
const X_ICON = { ios: "xmark", android: "close", web: "close" } as const;
const MENU_ICON = {
  ios: "ellipsis",
  android: "more_horiz",
  web: "more_horiz",
} as const;

/**
 * One meal slot of a day. Planned: a card (tap to view, … for actions).
 * Open: a full-bleed horizontal carousel of contenders plus Import / cookbook.
 * Handles its own horizontal padding so the carousel scrolls edge to edge.
 */
export function MealSection({
  title,
  recipe,
  contenders,
  onPlan,
  onMenu,
  onHide,
  onView,
  onImport,
  onCookbook,
}: Props) {
  const muted = useResolveClassNames("text-muted-foreground").color;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-6">
        <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </Text>
        {recipe ? null : (
          <Pressable hitSlop={12} onPress={onHide}>
            <SymbolView name={X_ICON} tintColor={muted} size={14} />
          </Pressable>
        )}
      </View>

      {recipe ? (
        <View className="px-6">
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <Pressable onPress={() => onView(recipe)}>
              <View className="h-36 items-center justify-center bg-muted">
                <SymbolView name={FOOD_ICON} tintColor={muted} size={28} />
              </View>
              <View className="p-4">
                <Text className="text-lg font-semibold">{recipe.name}</Text>
              </View>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => onMenu(recipe)}
              className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-background/80"
            >
              <SymbolView name={MENU_ICON} tintColor={muted} size={16} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          >
            {contenders.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onPlan(c)}
                className="w-40 overflow-hidden rounded-xl border border-border bg-card"
              >
                <View className="h-24 items-center justify-center bg-muted">
                  <SymbolView name={FOOD_ICON} tintColor={muted} size={22} />
                </View>
                <View className="p-3">
                  <Text numberOfLines={1} className="text-sm font-medium">
                    {c.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row gap-3 px-6">
            <Button variant="outline" className="flex-1" onPress={onImport}>
              <Text>Import</Text>
            </Button>
            <Button variant="outline" className="flex-1" onPress={onCookbook}>
              <Text>From cookbook</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
