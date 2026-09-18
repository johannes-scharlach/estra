import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import type { List, PlannedMeal, Variant as DbVariant } from "@/db/schema";
import { clearPlannedMeal, setPlannedMeal } from "@/db/planned-meals";
import {
  DayContent,
  type DisplayPlannedMeal,
  type DisplayRecipe,
} from "@/features/meals/day-content";
import { DayStrip } from "@/features/meals/day-strip";
import { eatersLabel, parseEaterIds, toEaters } from "@/features/meals/eaters";
import {
  addDays,
  dateKey,
  stripDates,
  SLOT_LABEL,
  type MealSlot,
} from "@/features/meals/slots";
import { usePanSwipeDay } from "@/features/meals/use-pan-swipe-day";
import { useImportJobs } from "@/features/meals/use-import-jobs";

export default function Meals() {
  const [{ dates, todayIndex }] = useState(stripDates);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [openSlots, setOpenSlots] = useState<Set<string>>(() => new Set());
  // optimistic pending — avoids flicker through hidden state while PowerSync query catches up
  const [pending, setPending] = useState<
    Record<string, DisplayPlannedMeal | null>
  >({});
  const importJobs = useImportJobs();
  const [cookbookSlot, setCookbookSlot] = useState<{
    slot: MealSlot;
    date: string;
  } | null>(null);
  const { width } = useWindowDimensions();

  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at LIMIT 1",
  );
  const list = lists[0] ?? null;

  const { data: planned } = useQuery<PlannedMeal>(
    list
      ? "SELECT * FROM planned_meals WHERE list_id = ?"
      : "SELECT * FROM planned_meals WHERE 0",
    list ? [list.id] : [],
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
  // contenders are variants (ADR 8: variant is the cookable entity)
  const contendersBySlot = useMemo((): Record<MealSlot, DisplayRecipe[]> => {
    const all: DisplayRecipe[] = variants
      .filter((v): v is DbVariant & { name: string } => !!v.name)
      .map((v) => ({ id: v.id, name: v.name, totalTime: v.total_time }));
    return { lunch: all, dinner: all, treat: all };
  }, [variants]);

  const todayKey = dateKey(new Date());
  const selDate = useMemo(
    () => dates.find((d) => dateKey(d) === selected) ?? new Date(),
    [dates, selected],
  );
  const prevDate = useMemo(() => {
    const d = addDays(selDate, -1);
    return dates.some((x) => dateKey(x) === dateKey(d)) ? d : null;
  }, [selDate, dates]);
  const nextDate = useMemo(() => {
    const d = addDays(selDate, 1);
    return dates.some((x) => dateKey(x) === dateKey(d)) ? d : null;
  }, [selDate, dates]);

  // The pager commits after its settle animation, so the selected day lags
  // the gesture by ~300ms. The page window (and its keys) always render from
  // the latest selection, and nodes are keyed by date — the landed page is
  // already on screen, the reset just re-centers the row in the same frame.
  const commitArmed = useRef(false);
  const pageRef = useRef({
    nextKey: null as string | null,
    prevKey: null as string | null,
  });
  useEffect(() => {
    pageRef.current = {
      nextKey: nextDate ? dateKey(nextDate) : null,
      prevKey: prevDate ? dateKey(prevDate) : null,
    };
  });
  const commitDay = useCallback((dir: 1 | -1) => {
    const key = dir === 1 ? pageRef.current.nextKey : pageRef.current.prevKey;
    if (!key) return;
    commitArmed.current = true;
    setSelected(key);
  }, []);
  const {
    gesture: dayPan,
    dragStyle,
    translateX,
  } = usePanSwipeDay({
    width,
    canGoPrev: !!prevDate,
    canGoNext: !!nextDate,
    onCommit: commitDay,
  });
  useLayoutEffect(() => {
    if (commitArmed.current) {
      commitArmed.current = false;
      // same frame as the re-render — the landed page doesn't move a pixel
      translateX.set(0);
    }
  }, [selected, translateX]);

  function plannedFor(date: string, slot: MealSlot): DisplayPlannedMeal | null {
    const k = `${date}:${slot}`;
    if (k in pending) return pending[k] ?? null;
    const row = planned.find((p) => p.slot_date === date && p.meal === slot);
    if (!row || !row.variant_id) return null;
    const v = variantById.get(row.variant_id);
    const eaterIds = parseEaterIds(row.eater_ids);
    const extraPortions = row.extra_portions ?? 0;
    return {
      id: row.variant_id,
      name: v?.name ?? "…",
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
      if ((p === null && !row?.variant_id) || (p && row?.variant_id === p.id)) {
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
        variantId: recipe.id,
        eaterIds: JSON.stringify(recipe.eaterIds),
        extraPortions: String(recipe.extraPortions),
      },
    });
  }

  function moveMeal(
    date: string,
    slot: MealSlot,
    recipe: DisplayPlannedMeal | null,
  ) {
    if (!list) return;
    router.push({
      pathname: "/meals/move",
      params: {
        listId: list.id,
        date,
        slot,
        variantId: recipe?.id,
      },
    });
  }

  function dayPage(date: Date | null, slot: "prev" | "current" | "next") {
    if (!list || !date) return <View key={`${slot}-empty`} style={{ width }} />;
    const key = dateKey(date);
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
          onHide={(slot) => void onHideOpen(key, slot)}
          onSetOpen={(slot, open) => setOpen(key, slot, open)}
          onImport={(slot) => openImport(key, slot)}
          onCookbook={(slot) => setCookbookSlot({ slot, date: key })}
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
                // -width rest offset would push every page off-screen
                width: width * 3,
              },
            ]}
          >
            {dayPage(prevDate, "prev")}
            {dayPage(selDate, "current")}
            {dayPage(nextDate, "next")}
          </Animated.View>
        </GestureDetector>
      </ScrollView>

      {/* Pick from cookbook for a specific slot */}
      <Modal
        visible={!!cookbookSlot}
        transparent
        animationType="fade"
        onRequestClose={() => setCookbookSlot(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => setCookbookSlot(null)}
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-h-[70%] overflow-hidden rounded-2xl border border-border bg-card"
          >
            <View className="border-b border-border/40 p-4">
              <Text variant="large">
                Cookbook → {cookbookSlot ? SLOT_LABEL[cookbookSlot.slot] : ""}
              </Text>
              <Text variant="muted">
                {variants.length
                  ? "Tap to plan"
                  : "No variants yet — import one first."}
              </Text>
            </View>
            <ScrollView contentContainerClassName="gap-2 p-3">
              {variants.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    if (cookbookSlot)
                      void onPlan(cookbookSlot.date, cookbookSlot.slot, {
                        id: r.id,
                        name: r.name ?? "…",
                        totalTime: r.total_time,
                      });
                    setCookbookSlot(null);
                  }}
                  className="rounded-xl border border-border p-3"
                >
                  <Text className="font-medium">{r.name ?? "…"}</Text>
                  {r.description ? (
                    <Text variant="muted" className="text-sm" numberOfLines={2}>
                      {r.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {variants.length === 0 ? (
                <Button
                  variant="outline"
                  onPress={() => {
                    if (cookbookSlot)
                      openImport(cookbookSlot.date, cookbookSlot.slot);
                    setCookbookSlot(null);
                  }}
                >
                  <Text>Import a recipe</Text>
                </Button>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
