import { SymbolView } from "expo-symbols";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { MealCardMenu } from "@/features/meals/meal-card-menu";
import { useMealSelectionTransition } from "@/features/meals/use-meal-selection-transition";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Recipe = { id: string; name: string; totalTime: string | null };

type Props = {
  title: string;
  /** Deterministic slot id; the recipe page uses it to know which meal it is about. */
  plannedMealId: string;
  /** Planned recipe, or null when the slot is still open. */
  recipe: (Recipe & { eatersLabel: string }) | null;
  contenders: Recipe[];
  onPlan: (recipe: Recipe) => void;
  onEditEaters: () => void;
  onChange: () => void;
  onSkip: () => void;
  onMove: () => void;
  /** Open slot's × — hides the slot behind "+ Select …". */
  onHide: () => void;
  onImport: () => void;
  onCookbook: () => void;
};

const X_ICON = { ios: "xmark", android: "close" } as const;
const CHECK_ICON = {
  ios: "checkmark",
  android: "check",
} as const;

/**
 * One meal slot of a day. Planned: a card (tap to view, … for actions).
 * Open: a full-bleed horizontal carousel of contenders plus Import / cookbook.
 * Handles its own horizontal padding so the carousel scrolls edge to edge.
 */
export function MealSection({
  title,
  plannedMealId,
  recipe,
  contenders,
  onPlan,
  onEditEaters,
  onChange,
  onSkip,
  onMove,
  onHide,
  onImport,
  onCookbook,
}: Props) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const dark = useColorScheme() === "dark";
  const {
    contentRef,
    selectContender,
    cardEnter,
    detailsEnter,
    choosingHeadingStyle,
    plannedHeadingStyle,
  } = useMealSelectionTransition(recipe?.id);
  const planned = !!recipe;

  return (
    <View className="gap-3">
      {/* Keep the longer heading and the status text in flow in both states.
          Opacity changes; the header's height and the card's origin do not. */}
      <View className="flex-row items-center justify-between gap-3 px-6">
        <View className="flex-1">
          <Animated.View
            style={choosingHeadingStyle}
            accessibilityElementsHidden={planned}
            importantForAccessibility={planned ? "no-hide-descendants" : "auto"}
          >
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Select {title.toLowerCase()}
            </Text>
          </Animated.View>
          <Animated.View
            style={plannedHeadingStyle}
            accessibilityElementsHidden={!planned}
            importantForAccessibility={planned ? "auto" : "no-hide-descendants"}
            className="absolute inset-0"
          >
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </Text>
          </Animated.View>
        </View>
        <View>
          <Animated.View
            style={plannedHeadingStyle}
            accessibilityElementsHidden={!planned}
            importantForAccessibility={planned ? "auto" : "no-hide-descendants"}
            className="flex-row items-center gap-1"
          >
            <SymbolView name={CHECK_ICON} tintColor={muted} size={12} />
            <Text className="text-xs text-muted-foreground">Planned</Text>
          </Animated.View>
          <Animated.View
            style={choosingHeadingStyle}
            pointerEvents={planned ? "none" : "box-none"}
            accessibilityElementsHidden={planned}
            importantForAccessibility={planned ? "no-hide-descendants" : "auto"}
            className="absolute inset-0 items-end justify-center"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hide ${title.toLowerCase()} choices`}
              disabled={planned}
              hitSlop={12}
              onPress={onHide}
            >
              <SymbolView name={X_ICON} tintColor={muted} size={14} />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <View ref={contentRef} collapsable={false}>
        {recipe ? (
          <Animated.View
            entering={cardEnter}
            className="mx-6 overflow-hidden rounded-xl border border-border bg-card"
          >
            <Link
              href={{
                pathname: "/variant/[id]",
                params: { id: recipe.id, plannedMealId },
              }}
              asChild
            >
              <Pressable>
                {/* Same tonalPair as the cookbook row and hero — one identity per recipe. */}
                <View className="h-36">
                  <LinearGradient
                    colors={tonalPair(recipe.id, dark)}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={{ flex: 1 }}
                  />
                  <Animated.View
                    entering={detailsEnter}
                    className="absolute bottom-3 left-3 right-3 flex-row flex-wrap items-end justify-between gap-2"
                  >
                    {recipe.totalTime ? (
                      <Text className="rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium">
                        {recipe.totalTime}
                      </Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      className="ml-auto max-w-[60%] rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium"
                    >
                      {recipe.eatersLabel}
                    </Text>
                  </Animated.View>
                </View>
                <Animated.View entering={detailsEnter} className="p-4">
                  <Text className="text-lg font-semibold">{recipe.name}</Text>
                </Animated.View>
              </Pressable>
            </Link>
            <Animated.View
              entering={detailsEnter}
              pointerEvents="box-none"
              className="absolute inset-0"
            >
              <MealCardMenu
                recipeId={recipe.id}
                recipeName={recipe.name}
                eatersLabel={recipe.eatersLabel}
                onEditEaters={onEditEaters}
                onChange={onChange}
                onMove={onMove}
                onSkip={onSkip}
              />
            </Animated.View>
          </Animated.View>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${c.name} for ${title.toLowerCase()}`}
                  onPress={(event) =>
                    selectContender(c.id, event, () => onPlan(c))
                  }
                  className="w-40 overflow-hidden rounded-xl border border-border bg-card"
                >
                  <View className="h-24">
                    <LinearGradient
                      colors={tonalPair(c.id, dark)}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={{ flex: 1 }}
                    />
                    {c.totalTime ? (
                      <Text className="absolute bottom-2 left-2 max-w-[90%] rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium">
                        {c.totalTime}
                      </Text>
                    ) : null}
                  </View>
                  <View className="p-3">
                    <Text
                      numberOfLines={2}
                      className="min-h-10 text-sm font-medium leading-5"
                    >
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
    </View>
  );
}
