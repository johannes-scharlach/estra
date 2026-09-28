import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import type { Variant as DbVariant } from "@/db/schema";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { clearPlannedMeal, setPlannedMeal } from "@/db/planned-meals";
import {
  DayContent,
  type DisplayPlannedMeal,
  type DisplayRecipe,
} from "@/features/meals/day-content";
import { DayStrip } from "@/features/meals/day-strip";
import { eatersLabel, parseEaterIds, toEaters } from "@/features/meals/eaters";
import {
  dateKey,
  stripDates,
  type MealSlot,
} from "@/features/meals/slots";
import { usePanSwipeDay } from "@/features/meals/use-pan-swipe-day";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { useActiveList } from "@/features/onboarding/access";
import { useRecipeChoices } from "@/features/cookbook/use-recipe-choices";
import { useToday } from "@/hooks/use-today";

export default function Meals() {
  const [{ dates, todayIndex }] = useState(stripDates);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [openSlots, setOpenSlots] = useState<Set<string>>(() => new Set());
  // optimistic pending — avoids flicker through hidden state while PowerSync query catches up
  const [pending, setPending] = useState<
    Record<string, DisplayPlannedMeal | null>
  >({});
  const importJobs = useImportJobs();
  const { choices } = useRecipeChoices();
  const { width } = useWindowDimensions();

  const list = useActiveList();

  const { data: planned } = useQuery<ShoppingMeal>(
    `${MEALS_WITH_SHOPPING} WHERE pm.list_id = ?`,
    [list?.id ?? ""],
  );
  const { data: variants } = useQuery<DbVariant>(
    "SELECT * FROM variants ORDER BY created_at DESC",
  );
  const { session } = useAuth();
  const { data: peopleRows } = useQuery<{
    id: string;
    name: string;
    user_id: string | null;
  }>(
    "SELECT id, name, user_id FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [list?.id ?? ""],
  );
  const people = useMemo(
    () => toEaters(peopleRows, session?.user.id),
    [peopleRows, session],
  );

  const variantById = useMemo(
    () => new Map(variants.map((v) => [v.id, v])),
    [variants],
  );
  // Recently added recipe groups, each represented by its newest variant.
  const contendersBySlot = useMemo((): Record<MealSlot, DisplayRecipe[]> => {
    const all: DisplayRecipe[] = choices
      .slice(0, 10)
      .map(({ variant: v }) => ({
        id: v.id,
        recipeId: v.recipe_id!,
        name: v.name ?? "…",
        totalTime: v.total_time,
      }));
    return { lunch: all, dinner: all, treat: all };
  }, [choices]);

  const todayKey = useToday();
  const selIndex = Math.max(
    0,
    dates.findIndex((d) => dateKey(d) === selected),
  );
  const commitDay = useCallback(
    (index: number) => setSelected(dateKey(dates[index]!)),
    [dates],
  );
  const { gesture: dayPan, dragStyle } = usePanSwipeDay({
    width,
    count: dates.length,
    index: selIndex,
    onCommit: commitDay,
  });

  function plannedFor(date: string, slot: MealSlot): DisplayPlannedMeal | null {
    const k = `${date}:${slot}`;
    if (k in pending) return pending[k] ?? null;
    const row = planned.find((p) => p.slot_date === date && p.meal === slot);
    if (!row) return null;
    const v = row.variant_id ? variantById.get(row.variant_id) : null;
    const eaterIds = parseEaterIds(row.eater_ids);
    const extraPortions = row.extra_portions ?? 0;
    return {
      id: row.variant_id ?? row.id,
      variantId: row.variant_id,
      shoppingReviewed: !!row.shopping_reviewed,
      recipeId: row.recipe_id,
      name: row.name ?? v?.name ?? "…",
      totalTime: v?.total_time ?? null,
      eaterIds,
      extraPortions,
      eatersLabel: eatersLabel({ people, eaterIds, extraPortions }),
    };
  }

  // clear optimistic pending once the real row arrives / disappears
  useEffect(() => {
    for (const [k, p] of Object.entries(pending)) {
      const [date, slot] = k.split(":") as [string, MealSlot];
      const row = planned.find((r) => r.slot_date === date && r.meal === slot);
      if ((p === null && !row) || (p && row?.variant_id === p.variantId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing optimistic pending once PowerSync catches up
        setPending((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
      }
    }
  }, [planned, pending]);

  function setOpen(date: string, slot: MealSlot, open: boolean) {
    setOpenSlots((prev) => {
      const next = new Set(prev);
      const k = `${date}:${slot}`;
      if (open) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  async function onPlan(date: string, slot: MealSlot, recipe: DisplayRecipe) {
    if (!list) return;
    const k = `${date}:${slot}`;
    // Same default the write applies: everyone in the household, no extra.
    const eaterIds = people.map((p) => p.id);
    setPending((prev) => ({
      ...prev,
      [k]: {
        ...recipe,
        variantId: recipe.id,
        shoppingReviewed: false,
        eaterIds,
        extraPortions: 0,
        eatersLabel: eatersLabel({ people, eaterIds, extraPortions: 0 }),
      },
    }));
    setOpen(date, slot, false);
    try {
      // DisplayRecipe id is now variant id (ADR 8)
      const v = variantById.get(recipe.id);
      await setPlannedMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        recipeId: v?.recipe_id ?? recipe.id,
        variantId: recipe.id,
      });
    } catch {
      // rollback optimistic on failure
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setOpen(date, slot, true);
    }
  }

  async function onHideOpen(date: string, slot: MealSlot) {
    setOpen(date, slot, false);
  }

  async function changeMeal(date: string, slot: MealSlot) {
    if (!list) return;
    const k = `${date}:${slot}`;
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(date, slot, true);
    try {
      await clearPlannedMeal(list.id, date, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  async function skipMeal(date: string, slot: MealSlot) {
    if (!list) return;
    const k = `${date}:${slot}`;
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(date, slot, false);
    try {
      await clearPlannedMeal(list.id, date, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function openImport(date: string, slot: MealSlot) {
    router.push({ pathname: "/meals/import", params: { slot, date } });
  }

  function editEaters(
    date: string,
    slot: MealSlot,
    recipe: DisplayPlannedMeal | null,
  ) {
    if (!list || !recipe) return;
    router.push({
      pathname: "/meals/eaters",
      params: {
        listId: list.id,
        date,
        slot,
        variantId: recipe.variantId ?? "",
        eaterIds: JSON.stringify(recipe.eaterIds),
        extraPortions: String(recipe.extraPortions),
      },
    });
  }

  function moveMeal(
    date: string,
    slot: MealSlot,
    recipe: DisplayPlannedMeal | null,
    repeat = false,
  ) {
    if (!list) return;
    router.push({
      pathname: "/meals/move",
      params: {
        listId: list.id,
        date,
        slot,
        variantId: recipe?.variantId ?? "",
        mode: repeat ? "repeat" : "move",
      },
    });
  }

  function dayPage(date: Date, index: number) {
    const key = dateKey(date);
    // Only the selected day and its neighbours mount; the rest hold their slot.
    if (!list || Math.abs(index - selIndex) > 1)
      return <View key={key} style={{ width }} />;
    return (
      <View key={key} style={{ width }}>
        <DayContent
          date={date}
          isToday={key === todayKey}
          list={list}
          importJobs={importJobs}
          plannedFor={plannedFor}
          contenders={contendersBySlot}
          isOpen={(slot) => openSlots.has(`${key}:${slot}`)}
          onPlan={(slot, r) => void onPlan(key, slot, r)}
          onEditEaters={(slot, r) => editEaters(key, slot, r)}
          onChange={(slot) => void changeMeal(key, slot)}
          onSkip={(slot) => void skipMeal(key, slot)}
          onMove={(slot, r) => moveMeal(key, slot, r)}
          onRepeat={(slot, r) => moveMeal(key, slot, r, true)}
          onHide={(slot) => void onHideOpen(key, slot)}
          onSetOpen={(slot, open) => setOpen(key, slot, open)}
          onImport={(slot) => openImport(key, slot)}
          onCookbook={(slot) =>
            router.push({
              pathname: "/meals/pick",
              params: { slot, date: key },
            })
          }
          onWriteIn={(slot) =>
            router.push({
              pathname: "/meals/write",
              params: { slot, date: key },
            })
          }
        />
      </View>
    );
  }

  if (!list) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text variant="muted">No list yet — create one in Shop first.</Text>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="flex-grow"
      >
        <View className="mt-4">
          <DayStrip
            dates={dates}
            todayIndex={todayIndex}
            selected={selected}
            onSelect={setSelected}
          />
        </View>

        <GestureDetector gesture={dayPan}>
          <Animated.View
            style={[
              dragStyle,
              {
                flexGrow: 1,
                flexDirection: "row",
                overflow: "hidden",
                paddingBottom: 40,
                // explicit: a stretched row would be viewport-wide and the
                // page offset would push every page off-screen
                width: width * dates.length,
              },
            ]}
          >
            {dates.map(dayPage)}
          </Animated.View>
        </GestureDetector>
      </ScrollView>
    </>
  );
}
