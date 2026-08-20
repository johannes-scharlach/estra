import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Animated, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  CONTENDERS,
  dateKey,
  demoPlans,
  MONTH_SHORT,
  SLOT_LABEL,
  SLOT_ORDER,
  slotState,
  stripDates,
  WEEKDAY_LONG,
  type DayMeals,
  type MealSlot,
  type Recipe,
  type SlotValue,
} from "@/features/meals/demo-data";
import { DayStrip } from "@/features/meals/day-strip";
import { MealSection } from "@/features/meals/meal-section";
import { cn } from "@/lib/utils";

/** Height of the fixed top bar (below the safe area). */
const BAR_H = 44;

const CAL_ICON = {
  ios: "calendar",
  android: "calendar_month",
  web: "calendar_month",
} as const;
const PLUS_ICON = { ios: "plus", android: "add", web: "add" } as const;
const CHANGE_ICON = {
  ios: "arrow.2.squarepath",
  android: "autorenew",
  web: "autorenew",
} as const;
const MOVE_ICON = {
  ios: "arrow.left.arrow.right",
  android: "swap_horiz",
  web: "swap_horiz",
} as const;
const SKIP_ICON = { ios: "forward.end", android: "skip_next", web: "skip_next" } as const;

export default function Meals() {
  const insets = useSafeAreaInsets();
  const [{ dates, todayIndex }] = useState(stripDates);
  const [plans, setPlans] = useState(demoPlans);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [jumpOpen, setJumpOpen] = useState(false);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [menu, setMenu] = useState<{ slot: MealSlot; recipe: Recipe } | null>(null);
  const [moving, setMoving] = useState(false);
  const iconColor = useResolveClassNames("text-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  // Created once; Animated.event wires it to the scroll view below.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [smallTitleOpacity] = useState(() =>
    scrollY.interpolate({
      inputRange: [28, 48],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
  );
  const [largeTitleOpacity] = useState(() =>
    scrollY.interpolate({
      inputRange: [0, 32],
      outputRange: [1, 0],
      extrapolate: "clamp",
    }),
  );

  const todayKey = dateKey(new Date());
  const selDate = dates.find((d) => dateKey(d) === selected) ?? new Date();
  const isToday = selected === todayKey;
  const day: DayMeals = plans[selected] ?? {};

  function setSlot(dayKey: string, slot: MealSlot, value: SlotValue | undefined) {
    setPlans((prev) => {
      const dayPlan = { ...(prev[dayKey] ?? {}) };
      if (value === undefined) delete dayPlan[slot];
      else dayPlan[slot] = value;
      return { ...prev, [dayKey]: dayPlan };
    });
  }

  /** Hiding lunch/dinner marks them skipped; treat goes back behind "+ Add treat". */
  function hideSlot(slot: MealSlot) {
    setSlot(selected, slot, slot === "treat" ? undefined : "skipped");
  }

  function closeMenu() {
    setMenu(null);
    setMoving(false);
  }

  function changeMeal() {
    if (menu) setSlot(selected, menu.slot, null);
    closeMenu();
  }

  function skipMeal() {
    if (menu) hideSlot(menu.slot);
    closeMenu();
  }

  /** Swap when the target slot is planned, plain move otherwise. */
  function moveTo(target: MealSlot) {
    if (!menu) return;
    setPlans((prev) => {
      const dayPlan = { ...(prev[selected] ?? {}) };
      const targetVal = dayPlan[target];
      dayPlan[target] = menu.recipe;
      dayPlan[menu.slot] =
        targetVal === undefined || targetVal === "skipped" ? null : targetVal;
      return { ...prev, [selected]: dayPlan };
    });
    closeMenu();
  }

  const moveTargets = menu ? SLOT_ORDER.filter((s) => s !== menu.slot) : [];

  return (
    <View className="flex-1 bg-background">
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={{
          paddingTop: insets.top + BAR_H,
          paddingBottom: 40,
        }}
      >
        <Animated.View style={{ opacity: largeTitleOpacity }} className="px-6 pt-2">
          <Text className="text-4xl font-bold tracking-tight">Meals</Text>
        </Animated.View>

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
            const state = slotState(day, slot);
            if (state === "hidden") {
              return (
                <Pressable
                  key={slot}
                  onPress={() => setSlot(selected, slot, null)}
                  className="flex-row items-center gap-2 px-6"
                >
                  <SymbolView name={PLUS_ICON} tintColor={mutedColor} size={16} />
                  <Text className="text-muted-foreground">Add {slot}</Text>
                </Pressable>
              );
            }
            return (
              <MealSection
                key={slot}
                title={SLOT_LABEL[slot]}
                recipe={state}
                contenders={CONTENDERS[slot]}
                onPlan={(r) => setSlot(selected, slot, r)}
                onMenu={(r) => setMenu({ slot, recipe: r })}
                onHide={() => hideSlot(slot)}
                onView={setViewing}
              />
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* Fixed top bar: actions always visible, small title fades in on scroll. */}
      <View
        style={{ paddingTop: insets.top }}
        className="absolute inset-x-0 top-0 z-10 bg-background"
      >
        <View className="h-11 flex-row items-center justify-between px-6">
          <Animated.View style={{ opacity: smallTitleOpacity }}>
            <Text className="text-lg font-semibold">Meals</Text>
          </Animated.View>
          <View className="flex-row items-center">
            <Pressable hitSlop={12} onPress={() => setJumpOpen(true)} className="p-2">
              <SymbolView name={CAL_ICON} tintColor={iconColor} size={22} />
            </Pressable>
            <Pressable
              hitSlop={12}
              onPress={() => router.push("/meals/plan")}
              className="p-2"
            >
              <SymbolView name={PLUS_ICON} tintColor={iconColor} size={24} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Planned meal detail — placeholder until recipes exist. */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-8"
          onPress={() => setViewing(null)}
        >
          <Pressable
            onPress={() => {}}
            className="w-full gap-4 rounded-2xl border border-border bg-card p-6"
          >
            <View className="gap-1">
              <Text variant="large">{viewing?.name}</Text>
              <Text variant="muted">Recipe details coming soon.</Text>
            </View>
            <Button variant="outline" onPress={() => setViewing(null)}>
              <Text>Close</Text>
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Slot actions — bottom action sheet; "Move to…" swaps in a slot list. */}
      <Modal
        visible={!!menu}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeMenu}>
          <Pressable
            onPress={() => {}}
            className="gap-2 px-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className="overflow-hidden rounded-2xl bg-card">
              {moving ? (
                <>
                  <View className="border-b border-border/40 px-5 py-3">
                    <Text variant="muted" className="text-center">
                      Move {menu?.recipe.name} to…
                    </Text>
                  </View>
                  {moveTargets.map((s, i) => (
                    <Pressable
                      key={s}
                      onPress={() => moveTo(s)}
                      className={cn(
                        "px-5 py-4",
                        i < moveTargets.length - 1 && "border-b border-border/40",
                      )}
                    >
                      <Text className="text-center">{SLOT_LABEL[s]}</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <View className="border-b border-border/40 px-5 py-3">
                    <Text variant="muted" className="text-center">
                      {menu?.recipe.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={changeMeal}
                    className="flex-row items-center justify-center gap-3 border-b border-border/40 px-5 py-4"
                  >
                    <SymbolView name={CHANGE_ICON} tintColor={iconColor} size={18} />
                    <Text>Change meal</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMoving(true)}
                    className="flex-row items-center justify-center gap-3 border-b border-border/40 px-5 py-4"
                  >
                    <SymbolView name={MOVE_ICON} tintColor={iconColor} size={18} />
                    <Text>Move to…</Text>
                  </Pressable>
                  <Pressable
                    onPress={skipMeal}
                    className="flex-row items-center justify-center gap-3 px-5 py-4"
                  >
                    <SymbolView name={SKIP_ICON} tintColor={iconColor} size={18} />
                    <Text>Skip this meal</Text>
                  </Pressable>
                </>
              )}
            </View>
            <Pressable
              onPress={closeMenu}
              className="items-center rounded-2xl bg-card py-4"
            >
              <Text className="font-semibold">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date jump — plain list, cheaper than a calendar picker. */}
      <Modal
        visible={jumpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setJumpOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-8"
          onPress={() => setJumpOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            className="w-full overflow-hidden rounded-2xl border border-border bg-card"
          >
            <ScrollView className="max-h-96">
              {dates.map((d) => {
                const key = dateKey(d);
                const hasPlan = Object.values(plans[key] ?? {}).some(
                  (v) => !!v && v !== "skipped",
                );
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelected(key);
                      setJumpOpen(false);
                    }}
                    className="flex-row items-center justify-between gap-4 border-b border-border/40 px-5 py-3.5"
                  >
                    <Text className={cn(key === selected && "font-semibold")}>
                      {WEEKDAY_LONG[d.getDay()]}, {d.getDate()}{" "}
                      {MONTH_SHORT[d.getMonth()]}
                    </Text>
                    {key === todayKey ? (
                      <Text variant="muted">Today</Text>
                    ) : hasPlan ? (
                      <View className="size-1.5 rounded-full bg-muted-foreground/60" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
