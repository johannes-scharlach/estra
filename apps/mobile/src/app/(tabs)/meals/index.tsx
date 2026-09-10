import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  dateKey,
  MONTH_SHORT,
  SLOT_LABEL,
  SLOT_ORDER,
  stripDates,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";
import { DayStrip } from "@/features/meals/day-strip";
import { MealSection } from "@/features/meals/meal-section";
import type { List, PlannedMeal, Variant as DbVariant } from "@/db/schema";
import {
  clearPlannedMeal,
  setPlannedMeal,
} from "@/db/planned-meals";
import { useImportJobs } from "@/features/meals/use-import-jobs";

const PLUS_ICON = { ios: "plus", android: "add" } as const;

type DisplayRecipe = { id: string; name: string; totalTime: string | null };
type DisplayPlannedMeal = DisplayRecipe & { servings: number | null };

export default function Meals() {
  const [{ dates, todayIndex }] = useState(stripDates);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [openSlots, setOpenSlots] = useState<Set<string>>(() => new Set());
  // optimistic pending — avoids flicker through hidden state while PowerSync query catches up
  const [pending, setPending] = useState<Record<string, DisplayPlannedMeal | null>>(
    {},
  );
  const importJobs = useImportJobs();
  const [cookbookSlot, setCookbookSlot] = useState<MealSlot | null>(null);
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

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
  const selDate = dates.find((d) => dateKey(d) === selected) ?? new Date();
  const isToday = selected === todayKey;

  function plannedFor(date: string, slot: MealSlot): DisplayPlannedMeal | null {
    const k = `${date}:${slot}`;
    if (k in pending) return pending[k] ?? null;
    const row = planned.find((p) => p.slot_date === date && p.meal === slot);
    if (!row || !row.variant_id) return null;
    const v = variantById.get(row.variant_id);
    return {
      id: row.variant_id,
      name: v?.name ?? "…",
      totalTime: v?.total_time ?? null,
      servings: row.servings,
    };
  }

  // clear optimistic pending once the real row arrives / disappears
  useEffect(() => {
    for (const [k, p] of Object.entries(pending)) {
      const [date, slot] = k.split(":") as [string, MealSlot];
      const row = planned.find((r) => r.slot_date === date && r.meal === slot);
      if (
        (p === null && !row?.variant_id) ||
        (p && row?.variant_id === p.id && row.servings === p.servings)
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing optimistic pending once PowerSync catches up
        setPending((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
      }
    }
  }, [planned, pending]);

  function openKey(slot: MealSlot) {
    return `${selected}:${slot}`;
  }

  function setOpen(slot: MealSlot, open: boolean) {
    setOpenSlots((prev) => {
      const next = new Set(prev);
      const k = openKey(slot);
      if (open) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  async function onPlan(slot: MealSlot, recipe: DisplayRecipe) {
    if (!list) return;
    const k = `${selected}:${slot}`;
    const servings = 2;
    setPending((prev) => ({ ...prev, [k]: { ...recipe, servings } }));
    setOpen(slot, false);
    try {
      // DisplayRecipe id is now variant id (ADR 8)
      const v = variantById.get(recipe.id);
      await setPlannedMeal({
        listId: list.id,
        slotDate: selected,
        meal: slot,
        recipeId: v?.recipe_id ?? recipe.id,
        variantId: recipe.id,
        servings,
      });
    } catch {
      // rollback optimistic on failure
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setOpen(slot, true);
    }
  }

  async function onHideOpen(slot: MealSlot) {
    setOpen(slot, false);
  }

  async function changeMeal(slot: MealSlot) {
    if (!list) return;
    const k = `${selected}:${slot}`;
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(slot, true);
    try {
      await clearPlannedMeal(list.id, selected, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  async function skipMeal(slot: MealSlot) {
    if (!list) return;
    const k = `${selected}:${slot}`;
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(slot, false);
    try {
      await clearPlannedMeal(list.id, selected, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function openImport(slot: MealSlot) {
    router.push({ pathname: "/meals/import", params: { slot, date: selected } });
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
        contentContainerClassName="pb-10"
      >
        <View className="mt-4">
          <DayStrip
            dates={dates}
            todayIndex={todayIndex}
            selected={selected}
            onSelect={setSelected}
          />
        </View>

        <View className="mt-6 flex-row items-baseline gap-2 px-6">
          <Text variant="large">
            {isToday ? "Today" : WEEKDAY_LONG[selDate.getDay()]}
          </Text>
          <Text variant="muted">
            {isToday ? `${WEEKDAY_LONG[selDate.getDay()]}, ` : ""}
            {selDate.getDate()} {MONTH_SHORT[selDate.getMonth()]}
          </Text>
        </View>

        <View className="mt-6 gap-8">
          {SLOT_ORDER.map((slot) => {
            const target = { listId: list.id, date: selected, slot };
            const job = importJobs.getForSlot(target);
            if (job) {
              return (
                <View key={slot} className="gap-3 px-6" accessibilityLiveRegion="polite">
                  <Text variant="muted">{SLOT_LABEL[slot]}</Text>
                  {job.status === "error" ? (
                    <>
                      <Text className="text-destructive">{job.error.message}</Text>
                      {job.error.retryable ? (
                        <Button variant="outline" onPress={() => void importJobs.retry(target)}>
                          <Text>Retry</Text>
                        </Button>
                      ) : null}
                      <Button variant="ghost" onPress={() => importJobs.dismiss(target)}>
                        <Text>Dismiss</Text>
                      </Button>
                    </>
                  ) : (
                    <View className="flex-row items-center gap-3">
                      <ActivityIndicator />
                      <Text>{job.status === "syncing" ? "Syncing meal…" : "Importing & planning…"}</Text>
                    </View>
                  )}
                </View>
              );
            }
            const recipe = plannedFor(selected, slot);
            const k = openKey(slot);
            const isOpen = openSlots.has(k);
            if (!recipe && !isOpen) {
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  onPress={() => setOpen(slot, true)}
                  className="flex-row items-center gap-2 px-6"
                >
                  <SymbolView
                    name={PLUS_ICON}
                    tintColor={mutedColor}
                    size={16}
                  />
                  <Text className="text-muted-foreground">Select {slot}</Text>
                </Pressable>
              );
            }
            return (
              <MealSection
                key={slot}
                title={SLOT_LABEL[slot]}
                recipe={recipe}
                contenders={contendersBySlot[slot].slice(0, 20)}
                onPlan={(r) => void onPlan(slot, r)}
                onEditPortions={() =>
                  router.push({
                    pathname: "/meals/portions",
                    params: {
                      listId: list.id,
                      date: selected,
                      slot,
                      variantId: recipe?.id,
                      portions: recipe?.servings ?? 2,
                    },
                  })
                }
                onChange={() => void changeMeal(slot)}
                onSkip={() => void skipMeal(slot)}
                onMove={() =>
                  router.push({
                    pathname: "/meals/move",
                    params: {
                      listId: list.id,
                      date: selected,
                      slot,
                      variantId: recipe?.id,
                    },
                  })
                }
                onHide={() => onHideOpen(slot)}
                onImport={() => openImport(slot)}
                onCookbook={() => setCookbookSlot(slot)}
              />
            );
          })}
        </View>
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
                Cookbook → {cookbookSlot ? SLOT_LABEL[cookbookSlot] : ""}
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
                      void onPlan(cookbookSlot, {
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
                    setCookbookSlot(null);
                    if (cookbookSlot) openImport(cookbookSlot);
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
