import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  type ColorValue,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { applySwap, setItemStatus } from "@/db/items";
import { createList } from "@/db/lists";
import { useAuth } from "@/db/provider";
import type { List, ListItem } from "@/db/schema";
import {
  alternativesForItem,
  orderedAlternatives,
  type Alternative,
} from "@/features/shop/alternatives";
import { SwipeItem } from "@/features/shop/swipe-item";
import { SwapSession } from "@/features/shop/swap-session";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 380;
const ROW_LAYOUT = LinearTransition.springify()
  .duration(400)
  .dampingRatio(1)
  .reduceMotion(ReduceMotion.System);
// Re-sorting needs readable travel, rather than a spring's front-loaded snap.
const SWAP_LAYOUT = LinearTransition.duration(650)
  .easing(Easing.bezier(0.42, 0, 0.58, 1))
  .reduceMotion(ReduceMotion.System);
const NOTICE_ENTER = FadeIn.duration(150);
const NOTICE_EXIT = FadeOut.duration(200);
type ShopRow = ListItem & {
  category_name: string | null;
  ingredient_lines: string | null;
};
type Entry = { key: string } & (
  | { kind: "header"; title: string }
  | { kind: "item"; item: ShopRow }
);

export default function Shop() {
  const { session } = useAuth();
  const router = useRouter();
  const iconColor = useResolveClassNames("text-foreground").color;
  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at",
  );
  const list = lists[0];

  if (!list) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text variant="muted">No lists yet.</Text>
        <Button onPress={() => void createList("Home", session?.user.id)}>
          <Text>Create one</Text>
        </Button>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/shop/add",
                  params: { listId: list.id },
                })
              }
              hitSlop={12}
              accessibilityLabel="Add item"
              accessibilityRole="button"
              className="items-center justify-center p-2"
            >
              <SymbolView
                name={{ ios: "plus", android: "add" }}
                tintColor={iconColor}
                size={22}
              />
            </Pressable>
          ),
        }}
      />
      <ListScreen key={list.id} list={list} />
    </>
  );
}

function IngredientContent({
  name,
  spec,
  plannedMeal,
  mutedColor,
  checked = false,
}: {
  name: string;
  spec: string | null;
  plannedMeal: boolean;
  mutedColor: ColorValue | undefined;
  checked?: boolean;
}) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center gap-2">
        <Text
          className={cn(
            "shrink text-sm font-medium",
            checked && "text-muted-foreground line-through",
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
        {plannedMeal ? (
          <SymbolView
            name={{ ios: "fork.knife", android: "restaurant" }}
            tintColor={mutedColor}
            size={12}
          />
        ) : null}
      </View>
      {spec ? (
        <Text
          variant="muted"
          className={cn("text-xs", checked && "line-through")}
          numberOfLines={1}
        >
          {spec}
        </Text>
      ) : null}
    </View>
  );
}

function ListScreen({ list }: { list: List }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sessions = useRef(new Map<string, SwapSession>());
  const [swapSessions, setSwapSessions] = useState(
    new Map<string, SwapSession>(),
  );
  const [selected, setSelected] = useState(new Map<string, Alternative>());
  const [heldPositions, setHeldPositions] = useState(new Map<string, {
    itemId: string;
    index: number;
    categoryId: string | null;
    categoryName: string | null;
  }>());
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const lastSwap = useRef<{
    itemId: string;
    name: string;
    previousName: string;
  } | null>(null);
  const [notice, setNotice] = useState<{
    itemId: string;
    name: string;
    category: string;
    previousName: string;
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewport = useRef({ y: 0, height: 0 });

  useEffect(() => {
    const map = timers.current;
    const activeSessions = sessions.current;
    return () => {
      map.forEach(clearTimeout);
      activeSessions.forEach((session) => session.dispose());
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useFocusEffect(() => {
    // Resorting happens on revisit: holds live until the screen loses focus.
    return () => {
      sessions.current.forEach((session) => session.dispose());
      sessions.current.clear();
      setSwapSessions(new Map());
      setHeldPositions(new Map());
      setSelected(new Map());
      setHighlighted(null);
      setNotice(null);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  });

  const { data: rows } = useQuery<ShopRow>(
    `SELECT i.*, c.name AS category_name, v.ingredient_lines
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN variants v ON v.id = i.variant_id
      WHERE i.list_id = ?
      ORDER BY i.status,
               CASE WHEN i.status = 'purchased' THEN i.updated_at END DESC,
               COALESCE(c.sort_order, 999), COALESCE(c.name, 'zzz'), i.name, i.id`,
    [list.id],
  );
  const active = rows.filter((item) => item.status === "active");
  for (const heldPosition of [...heldPositions.values()].sort(
    (a, b) => a.index - b.index,
  )) {
    const index = active.findIndex((item) => item.id === heldPosition.itemId);
    const heldItem = active[index];
    if (heldItem) {
      active.splice(index, 1);
      // A shared edit can shift indices during the hold; don't split a category.
      const first = active.findIndex(
        (item) => item.category_id === heldPosition.categoryId,
      );
      const last = active.findLastIndex(
        (item) => item.category_id === heldPosition.categoryId,
      );
      let position = Math.min(heldPosition.index, active.length);
      if (first !== -1)
        position = Math.max(first, Math.min(position, last + 1));
      else {
        while (
          position > 0 &&
          position < active.length &&
          active[position]?.category_id === active[position - 1]?.category_id
        )
          position--;
      }
      active.splice(position, 0, {
        ...heldItem,
        category_id: heldPosition.categoryId,
        category_name: heldPosition.categoryName,
      });
    }
  }
  const checked = rows
    .filter((item) => item.status === "purchased")
    .slice(0, 50);

  function releasePosition(itemId: string) {
    sessions.current.get(itemId)?.dispose();
    sessions.current.delete(itemId);
    setSwapSessions((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    setHeldPositions((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    setSelected((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setHighlighted(null);
      setNotice(null);
    }, 4500);
  }

  // Headers and rows share one parent: category changes must move, not remount, a row.
  const entries: Entry[] = [];
  let category: string | null | undefined;
  for (const item of active) {
    if (item.category_id !== category) {
      category = item.category_id;
      entries.push({
        key: `category:${category}`,
        kind: "header",
        title: item.category_name ?? "Uncategorised",
      });
    }
    entries.push({ key: item.id, kind: "item", item });
  }
  if (checked.length) {
    entries.push({ key: "checked", kind: "header", title: "Checked" });
    for (const item of checked)
      entries.push({ key: item.id, kind: "item", item });
  }

  function toggleCheck(id: string) {
    if (timers.current.has(id)) {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      sessions.current.get(id)?.cancelCheck();
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (pending.has(id)) return;
    sessions.current.get(id)?.prepareCheck();
    setPending((prev) => new Set(prev).add(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        const purchase = () => setItemStatus(id, "purchased");
        const operation = sessions.current.get(id)?.check(purchase) ?? purchase();
        void operation
          .catch(() =>
            Alert.alert("Couldn't check off item", "Please try again."),
          )
          .finally(() =>
            setPending((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            }),
          );
      }, CHECK_DELAY_MS),
    );
  }

  function swap(item: ShopRow, direction: 1 | -1) {
    if (pending.has(item.id)) return false;
    let session = sessions.current.get(item.id);
    if (!session) {
      const options = orderedAlternatives(
        item.name ?? "",
        alternativesForItem(item.name ?? "", item.ingredient_lines),
      );
      if (options.length < 2) return false;
      setHeldPositions((current) =>
        new Map(current).set(item.id, {
          itemId: item.id,
          index: active.findIndex((row) => row.id === item.id),
          categoryId: item.category_id,
          categoryName: item.category_name,
        }),
      );
      const created = new SwapSession(options, {
        save: (option) => applySwap(item.id, option),
        change: (option) =>
          setSelected((current) => new Map(current).set(item.id, option)),
        release: () => releasePosition(item.id),
        error: () => {
          setHighlighted(null);
          Alert.alert("Couldn't swap item", "Please try again.");
        },
      });
      session = created;
      sessions.current.set(item.id, session);
      setSwapSessions((current) => new Map(current).set(item.id, created));
    }
    const index = session.options.indexOf(session.selected);
    const alternative = session.options[index + direction];
    if (!alternative) return false;
    lastSwap.current = {
      itemId: item.id,
      name: alternative.name.trim(),
      previousName: item.name ?? "Item",
    };
    setHighlighted(item.id);
    setNotice(null);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setHighlighted(null);
      setNotice(null);
    }, 4500);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    session.select(alternative);
    AccessibilityInfo.announceForAccessibility(`Changed to ${alternative.name}`);
    return true;
  }

  // Large title collapses only when the ScrollView is the first native
  // child of the screen (expo-router Stack docs). No wrapper View.
  return (
    <>
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        onLayout={(event) => {
          viewport.current.height = event.nativeEvent.layout.height;
        }}
        onScroll={(event) => {
          viewport.current.y = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {active.length === 0 ? (
          <Text variant="muted" className="px-6 py-4">
            Nothing on the list.
          </Text>
        ) : null}
        {entries.map((entry, index) => {
          if (entry.kind === "header") {
            return (
              <Animated.View
                key={entry.key}
                layout={ROW_LAYOUT}
                className="px-6 pb-2 pt-6"
              >
                <Text className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {entry.title}
                </Text>
              </Animated.View>
            );
          }
          const { item } = entry;
          const purchased = item.status === "purchased";
          const isPending = pending.has(item.id);
          const session = swapSessions.get(item.id);
          const optimistic = selected.get(item.id);
          const displayItem = optimistic
            ? {
                ...item,
                name: optimistic.name,
                spec:
                  [optimistic.qtyText, optimistic.prepNote]
                    .filter(Boolean)
                    .join(", ") || null,
              }
            : item;
          const options = purchased
            ? []
            : session?.options ??
              orderedAlternatives(
                displayItem.name ?? "",
                alternativesForItem(
                  displayItem.name ?? "",
                  displayItem.ingredient_lines,
                ),
              );
          const optionIndex = session
            ? session.options.indexOf(session.selected)
            : 0;
          const next = options[optionIndex + 1] ?? null;
          const previous = options[optionIndex - 1] ?? null;
          const isHighlighted = highlighted === item.id;
          return (
            <Animated.View
              key={entry.key}
              layout={isHighlighted ? SWAP_LAYOUT : ROW_LAYOUT}
              style={{ zIndex: isHighlighted ? 1 : 0 }}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                rowLayouts.current.set(item.id, { y, height });
                if (!isHighlighted || heldPositions.has(item.id)) return;
                const swapped = lastSwap.current;
                if (swapped?.itemId !== item.id || swapped.name !== item.name)
                  return;
                const visible = viewport.current;
                if (y + height < visible.y || y > visible.y + visible.height) {
                  setNotice({
                    itemId: item.id,
                    name: item.name ?? "Item",
                    category: item.category_name ?? "Uncategorised",
                    previousName: swapped.previousName,
                  });
                }
              }}
            >
              <View
                className={cn(
                  "flex-row items-center pl-3",
                  isHighlighted && "bg-accent",
                )}
              >
                <SwipeItem
                  leading={
                    <Pressable
                      onPress={() => {
                        if (purchased)
                          void setItemStatus(item.id, "active").catch(() =>
                            Alert.alert(
                              "Couldn't restore item",
                              "Please try again.",
                            ),
                          );
                        else toggleCheck(item.id);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: purchased || isPending }}
                      accessibilityLabel={`${purchased ? "Restore" : "Check off"} ${displayItem.name}`}
                      className="min-h-12 min-w-12 items-center justify-center"
                    >
                      <SymbolView
                        name={
                          purchased || isPending
                            ? {
                                ios: "checkmark.circle.fill",
                                android: "check_circle",
                              }
                            : {
                                ios: "circle",
                                android: "radio_button_unchecked",
                              }
                        }
                        tintColor={
                          purchased || isPending ? primaryColor : mutedColor
                        }
                        size={24}
                      />
                    </Pressable>
                  }
                  name={displayItem.name ?? ""}
                  next={next}
                  previous={previous}
                  disabled={purchased || isPending}
                  onSwap={(direction) => Promise.resolve(swap(displayItem, direction))}
                  renderOption={(option) => (
                    <IngredientContent
                      name={option.name}
                      spec={
                        [option.qtyText, option.prepNote]
                          .filter(Boolean)
                          .join(", ") || null
                      }
                      plannedMeal={!!item.planned_meal_id}
                      mutedColor={mutedColor}
                    />
                  )}
                  onOpen={() =>
                    router.push({
                      pathname: "/shop/item",
                      params: { itemId: item.id },
                    })
                  }
                >
                  <View
                    accessible
                    onAccessibilityTap={() =>
                      router.push({
                        pathname: "/shop/item",
                        params: { itemId: item.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${displayItem.name}${displayItem.spec ? `, ${displayItem.spec}` : ""}`}
                    accessibilityHint={
                      next || previous
                        ? "Swipe left for the next substitute, right for the previous. Tap for details."
                        : "Opens item details"
                    }
                    accessibilityActions={
                      next || previous
                        ? [
                            { name: "activate", label: "Open details" },
                            ...(next
                              ? [{ name: "next", label: `Use ${next.name}` }]
                              : []),
                            ...(previous
                              ? [
                                  {
                                    name: "previous",
                                    label: `Use ${previous.name}`,
                                  },
                                ]
                              : []),
                          ]
                        : [{ name: "activate", label: "Open details" }]
                    }
                    onAccessibilityAction={(event) => {
                      if (event.nativeEvent.actionName === "activate")
                        router.push({
                          pathname: "/shop/item",
                          params: { itemId: item.id },
                        });
                      if (event.nativeEvent.actionName === "next")
                        void swap(displayItem, 1);
                      if (event.nativeEvent.actionName === "previous")
                        void swap(displayItem, -1);
                    }}
                    className="min-h-12 gap-0.5 px-3 py-3"
                  >
                    <IngredientContent
                      name={displayItem.name ?? ""}
                      spec={displayItem.spec}
                      plannedMeal={!!displayItem.planned_meal_id}
                      mutedColor={mutedColor}
                      checked={purchased || isPending}
                    />
                  </View>
                </SwipeItem>
              </View>
              {entries[index + 1]?.kind === "item" ? (
                <View
                  pointerEvents="none"
                  className="absolute bottom-0 left-[72px] right-0 border-b border-border/60"
                />
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
      {notice ? (
        <Animated.View
          entering={NOTICE_ENTER}
          exiting={NOTICE_EXIT}
          className="absolute inset-x-4 rounded-xl bg-foreground"
          style={{ bottom: insets.bottom + 12 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${notice.name}, ${notice.category}, swapped for ${notice.previousName}. Show item`}
            accessibilityHint="Scrolls to the item in your shopping list"
            className="gap-1 px-5 py-4"
            onPress={() => {
              const layout = rowLayouts.current.get(notice.itemId);
              setNotice(null);
              if (!layout || !rows.some((item) => item.id === notice.itemId))
                return;
              scrollRef.current?.scrollTo({
                y: Math.max(
                  0,
                  layout.y - (viewport.current.height - layout.height) / 2,
                ),
                animated: !reducedMotion,
              });
              setHighlighted(notice.itemId);
              if (noticeTimer.current) clearTimeout(noticeTimer.current);
              noticeTimer.current = setTimeout(
                () => setHighlighted(null),
                4500,
              );
            }}
          >
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 text-base font-semibold text-background">
                {notice.name}
              </Text>
              <Text className="text-sm text-background underline">
                Show item
              </Text>
            </View>
            <Text
              accessibilityLiveRegion="polite"
              className="text-sm text-background"
            >
              {notice.category}, swapped for {notice.previousName}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  );
}
