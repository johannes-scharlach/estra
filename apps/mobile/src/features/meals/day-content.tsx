import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { plannedMealId } from "@/db/planned-meals";
import type { List } from "@/db/schema";
import { MealSection } from "@/features/meals/meal-section";
import {
  dateKey,
  MONTH_SHORT,
  SLOT_LABEL,
  SLOT_ORDER,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";
import type { ImportJobs } from "@/features/meals/import-jobs";
import { useToday } from "@/hooks/use-today";

const PLUS_ICON = { ios: "plus", android: "add" } as const;

export type DisplayRecipe = {
  id: string;
  recipeId: string | null;
  name: string;
  totalTime: string | null;
};
export type DisplayPlannedMeal = DisplayRecipe & {
  variantId: string | null;
  shoppingReviewed: boolean;
  eaterIds: string[];
  extraPortions: number;
  /** Rendered once here so the card and its menu agree. */
  eatersLabel: string;
};

type Props = {
  date: Date;
  isToday: boolean;
  list: List;
  importJobs: ImportJobs;
  plannedFor: (date: string, slot: MealSlot) => DisplayPlannedMeal | null;
  contenders: Record<MealSlot, DisplayRecipe[]>;
  isOpen: (slot: MealSlot) => boolean;
  onPlan: (slot: MealSlot, recipe: DisplayRecipe) => void;
  onEditEaters: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onChange: (slot: MealSlot) => void;
  onSkip: (slot: MealSlot) => void;
  onMove: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onRepeat: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onHide: (slot: MealSlot) => void;
  onSetOpen: (slot: MealSlot, open: boolean) => void;
  onImport: (slot: MealSlot) => void;
  onCookbook: (slot: MealSlot) => void;
  onWriteIn: (slot: MealSlot) => void;
};

/** Header + slot list for a single day. Pure render of its date's data. */
export function DayContent({
  date,
  isToday,
  list,
  importJobs,
  plannedFor,
  contenders,
  isOpen,
  onPlan,
  onEditEaters,
  onChange,
  onSkip,
  onMove,
  onRepeat,
  onHide,
  onSetOpen,
  onImport,
  onCookbook,
  onWriteIn,
}: Props) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const today = useToday();
  const dateStr = dateKey(date);

  return (
    <>
      <View className="mt-6 flex-row items-baseline gap-2 px-6">
        <Text variant="large">
          {isToday ? "Today" : WEEKDAY_LONG[date.getDay()]}
        </Text>
        <Text variant="muted">
          {isToday ? `${WEEKDAY_LONG[date.getDay()]}, ` : ""}
          {date.getDate()} {MONTH_SHORT[date.getMonth()]}
        </Text>
      </View>

      <View className="mt-6 gap-8">
        {SLOT_ORDER.map((slot) => {
          const target = { listId: list.id, date: dateStr, slot };
          const job = importJobs.getForSlot(target);
          if (job) {
            return (
              <View
                key={slot}
                className="gap-3 px-6"
                accessibilityLiveRegion="polite"
              >
                <Text variant="muted">{SLOT_LABEL[slot]}</Text>
                {job.status === "error" ? (
                  <>
                    <Text className="text-destructive">
                      {job.error.message}
                    </Text>
                    {job.error.retryable ? (
                      <Button
                        variant="outline"
                        onPress={() => void importJobs.retry(target)}
                      >
                        <Text>Retry</Text>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      onPress={() => importJobs.dismiss(target)}
                    >
                      <Text>Dismiss</Text>
                    </Button>
                  </>
                ) : (
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator />
                    <Text>
                      {job.status === "syncing"
                        ? "Syncing meal…"
                        : "Importing & planning…"}
                    </Text>
                  </View>
                )}
              </View>
            );
          }
          const recipe = plannedFor(dateStr, slot);
          const open = isOpen(slot);
          if (!recipe && !open) {
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                onPress={() => onSetOpen(slot, true)}
                className="flex-row items-center gap-2 px-6"
              >
                <SymbolView name={PLUS_ICON} tintColor={mutedColor} size={16} />
                <Text className="text-muted-foreground">Select {slot}</Text>
              </Pressable>
            );
          }
          return (
            <MealSection
              key={slot}
              title={SLOT_LABEL[slot]}
              date={dateStr}
              slot={slot}
              plannedMealId={plannedMealId(list.id, dateStr, slot)}
              listId={list.id}
              recipe={recipe}
              showShoppingPrompt={
                !!recipe && !recipe.shoppingReviewed && dateStr >= today
              }
              contenders={contenders[slot]}
              onPlan={(r) => onPlan(slot, r)}
              onEditEaters={() => onEditEaters(slot, recipe)}
              onChange={() => onChange(slot)}
              onSkip={() => onSkip(slot)}
              onMove={() => onMove(slot, recipe)}
              onRepeat={() => onRepeat(slot, recipe)}
              onHide={() => onHide(slot)}
              onImport={() => onImport(slot)}
              onCookbook={() => onCookbook(slot)}
              onWriteIn={() => onWriteIn(slot)}
            />
          );
        })}
      </View>
    </>
  );
}
