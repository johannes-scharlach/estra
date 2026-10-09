import { parseMealSwaps } from "@estra/meals";
import { MenuView } from "@expo/ui/community/menu";
import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Action } from "@/components/action";
import { Text } from "@/components/ui/text";
import { setMealSwap } from "@/db/meal-ingredients";
import { decideIngredients, parseAtHome } from "@/db/meal-shopping";
import type { ListItem, PlannedMeal } from "@/db/schema";
import { parseIngredientLines } from "@/db/variants";
import { DecisionPicker } from "@/features/meals/decision-picker";
import {
  optionsForLine,
  shoppingProgress,
  shoppingReview,
  type IngredientDecision,
} from "@/features/meals/shopping-review";
import { mealLabel } from "@/features/meals/variant-meals";
import { prettyQuantity, splitSpec } from "@/features/shop/spec";
import { capitalize } from "@/features/shop/text";

type Meal = PlannedMeal & {
  recipe_name: string | null;
  ingredient_lines: string | null;
};
type Entry = ReturnType<typeof shoppingReview>[number];
type Decide = (ingredientIds: number[], decision: "shop" | "home") => void;

// The system's popup-button glyph, as on the recipe page.
const POPUP_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

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
  return <IngredientReview meal={meal} lines={parsed} items={items} />;
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
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  // Decisions show on tap, not after the write comes back through the query:
  // that round trip is what made the rows feel late. A pending decision gives
  // way once the saved one matches it, or when its write fails.
  const [pending, setPending] = useState<
    ReadonlyMap<number, IngredientDecision>
  >(new Map());
  // Swaps show on pick the same way: the chosen option index, until saved.
  const [pendingSwaps, setPendingSwaps] = useState<ReadonlyMap<number, number>>(
    new Map(),
  );
  const savedSwaps = parseMealSwaps(meal.ingredient_swaps);
  const settledSwaps = [...pendingSwaps].filter(
    ([id, index]) => (savedSwaps[id] ?? 0) === index,
  );
  if (settledSwaps.length) {
    setPendingSwaps(withoutIds(pendingSwaps, settledSwaps.map(([id]) => id)));
  }
  const swaps = { ...savedSwaps };
  for (const [id, index] of pendingSwaps) {
    if (index) swaps[id] = index;
    else delete swaps[id];
  }
  const saved = shoppingReview(
    lines,
    items,
    swaps,
    parseAtHome(meal.ingredients_at_home),
  );
  const settled = saved.filter(
    (entry) =>
      entry.line.id != null &&
      pending.has(entry.line.id) &&
      (entry.decision === "bought" ||
        pending.get(entry.line.id) === entry.decision),
  );
  if (settled.length) {
    setPending(
      withoutIds(
        pending,
        settled.map((entry) => entry.line.id!),
      ),
    );
  }
  const review = saved.map((entry) => ({
    ...entry,
    decision:
      (entry.line.id != null && pending.get(entry.line.id)) || entry.decision,
  }));

  const run = (write: () => Promise<void>, undo?: () => void) => {
    setError(null);
    write().catch((e: unknown) => {
      undo?.();
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    });
  };
  const decide: Decide = (ingredientIds, decision) => {
    if (!meal.list_id || !meal.content_id || !meal.variant_id) return;
    const target = {
      listId: meal.list_id,
      mealId: meal.id,
      contentId: meal.content_id,
      variantId: meal.variant_id,
    };
    setPending((current) => {
      const next = new Map(current);
      for (const id of ingredientIds) next.set(id, decision);
      return next;
    });
    run(
      () => decideIngredients({ ...target, ingredientIds, decision }),
      () => setPending((current) => withoutIds(current, ingredientIds)),
    );
  };
  const swap = (ingredientId: number, index: number, name: string) => {
    if (!meal.variant_id) return;
    const variantId = meal.variant_id;
    setPendingSwaps((current) => new Map(current).set(ingredientId, index));
    run(
      () => setMealSwap({ mealId: meal.id, variantId, ingredientId, name }),
      () => setPendingSwaps((current) => withoutIds(current, [ingredientId])),
    );
  };

  // What is probably needed comes first: tap the cart on those, then mark
  // the rest at home in one go.
  const ordered = [
    ...review.filter((entry) => !entry.likelyHave),
    ...review.filter((entry) => entry.likelyHave),
  ];
  const undecided = ordered
    .filter((entry) => entry.decision === "undecided")
    .flatMap((entry) => (entry.line.id == null ? [] : [entry.line.id]));

  const markAtHome = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    decide(undecided, "home");
  };
  const markLabel =
    undecided.length === review.length
      ? `Mark all ${undecided.length} at home`
      : `Mark the remaining ${undecided.length} at home`;

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 24,
          gap: 20,
        }}
      >
        <View className="gap-1 px-6">
          <Text variant="h3">{meal.recipe_name}</Text>
          <Text variant="muted">{shoppingProgress(review)}</Text>
          {/* Android toolbars draw no labels, so the action stays in the content. */}
          {Platform.OS === "android" && undecided.length ? (
            <View className="pt-3">
              <Action label={markLabel} onPress={markAtHome} />
            </View>
          ) : null}
          {error ? (
            <Text selectable className="text-destructive">
              {error}
            </Text>
          ) : null}
        </View>
        <View>
          {ordered.map((entry, index) => (
            <IngredientRow
              key={entry.index}
              entry={entry}
              last={index === ordered.length - 1}
              decide={decide}
              swap={swap}
            />
          ))}
        </View>
      </ScrollView>
      {/* The slot heads the screen; the recipe heads the content. */}
      <Stack.Screen options={{ title: mealLabel(meal) }} />
      {/* A screen-wide action: the floating bar, within thumb reach, in words. */}
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Button
            hidden={undecided.length === 0}
            onPress={markAtHome}
          >
            {markLabel}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

/**
 * One primary line with its control, one secondary line below. The name opens
 * the swap menu; why an alternative suits lives in that menu, where it helps
 * the choice.
 */
function IngredientRow({
  entry,
  last,
  decide,
  swap,
}: {
  entry: Entry;
  /** Separators sit between rows, never after the last one. */
  last: boolean;
  decide: Decide;
  swap: (ingredientId: number, index: number, name: string) => void;
}) {
  const primary = useResolveClassNames("text-primary").color;
  const { line, optionIndex, item, decision } = entry;
  const options = optionsForLine(line);
  const chosen = options[optionIndex] ?? line;
  // A bought row shows what was actually bought.
  const bought = item?.status === "purchased";
  const name = capitalize(bought ? (item.name ?? "") : chosen.item_name);
  const amount = bought
    ? splitSpec(item.spec).amount
    : chosen.qty_text
      ? prettyQuantity(chosen.qty_text)
      : null;
  const others = options.filter((_, index) => index !== optionIndex);
  const canSwap = line.id != null && others.length > 0 && decision !== "bought";
  const detail = [
    amount,
    bought ? null : chosen.prep_note,
    canSwap ? `or ${others.map((option) => option.item_name).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const reasons = options
    .flatMap((option) =>
      "reason" in option && option.reason
        ? [`${capitalize(option.item_name)}: ${option.reason}`]
        : [],
    )
    .join("\n");
  const title = (
    <View className="flex-row items-center gap-1.5 self-start">
      <Text className="font-medium">{name}</Text>
      {canSwap ? (
        <SymbolView name={POPUP_ICON} tintColor={primary} size={11} />
      ) : null}
    </View>
  );

  return (
    // A plain iOS list: separators start at the text and run to the screen edge.
    <View
      className={`ml-6 gap-1 py-3 pr-6 ${last ? "" : "border-b border-border"}`}
    >
      {/* The control shares the name's line; the details get the full width. */}
      {/* The name sits low, on the baseline of the control's icons. */}
      <View className="min-h-9 flex-row items-end gap-3">
        <View className="min-w-0 flex-1 pb-1">
          {decision === "undecided" ? <UnreadDot /> : null}
          {canSwap ? (
            <MenuView
              // The host sizes itself to the label once; a new name is a new host.
              key={chosen.item_name}
              title={reasons}
              actions={options.map((option, index) => ({
                id: String(index),
                title: capitalize(option.item_name),
                state: index === optionIndex ? "on" : "off",
              }))}
              onPressAction={({ nativeEvent: { event } }) => {
                const option = options[Number(event)];
                if (option && Number(event) !== optionIndex)
                  swap(line.id!, Number(event), option.item_name);
              }}
            >
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${name}, choose an alternative`}
              >
                {title}
              </View>
            </MenuView>
          ) : (
            title
          )}
        </View>
        {line.id == null ? null : decision === "bought" ? (
          // Bought is a fact, not a choice: a badge the picker's size keeps
          // the column's rhythm.
          <View className="h-8 w-28 flex-row items-center justify-center gap-1.5 rounded-full bg-primary/10 android:h-10 android:w-32">
            <SymbolView
              name={{ ios: "checkmark", android: "check" }}
              tintColor={primary}
              size={13}
              weight="semibold"
            />
            <Text className="text-sm font-medium text-primary">Bought</Text>
          </View>
        ) : (
          <DecisionPicker
            value={decision === "undecided" ? null : decision}
            onChange={(next) => {
              void Haptics.selectionAsync();
              decide([line.id!], next);
            }}
          />
        )}
      </View>
      {detail ? <Text variant="muted">{detail}</Text> : null}
    </View>
  );
}

/**
 * Mail's unread dot: in the leading margin, centred on the name's line, it
 * marks the rows still waiting for a decision.
 */
function UnreadDot() {
  return (
    <View className="absolute -left-4 bottom-1 top-0 justify-center">
      <View className="size-2.5 rounded-full bg-primary" />
    </View>
  );
}

function withoutIds<V>(map: ReadonlyMap<number, V>, ids: readonly number[]) {
  const next = new Map(map);
  for (const id of ids) next.delete(id);
  return next;
}
