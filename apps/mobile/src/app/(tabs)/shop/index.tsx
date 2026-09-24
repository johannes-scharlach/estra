import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { applySwap, setItemStatus } from "@/db/items";
import type { List } from "@/db/schema";
import {
  alternativesForItem,
  orderedAlternatives,
} from "@/features/shop/alternatives";
import {
  type HeldPosition,
  holdPositions,
} from "@/features/shop/held-positions";
import {
  type Browse,
  ROW_LAYOUT,
  ShopItemRow,
  type ShopRow,
} from "@/features/shop/shop-item-row";
import { SwapSession } from "@/features/shop/swap-session";
import { sentenceCase } from "@/features/shop/text";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";

const HIGHLIGHT_MS = 4500;
type Held = Browse & { hold: HeldPosition };
type Entry = { key: string } & (
  | { kind: "header"; title: string }
  | { kind: "item"; item: ShopRow }
);

export default function Shop() {
  const router = useRouter();
  const iconColor = useResolveClassNames("text-foreground").color;
  const list = useActiveList();

  // The app only opens once a household is active; this covers the rebind.
  if (!list) return <View className="flex-1 bg-background" />;
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

function ListScreen({ list }: { list: List }) {
  const router = useRouter();
  const today = useToday();
  const insets = useSafeAreaInsets();
  // Sessions are imperative and never read during render; `browsing` holds
  // what the rows need to show for each one.
  const sessions = useRef(new Map<string, SwapSession>());
  const [browsing, setBrowsing] = useState(new Map<string, Held>());
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // The row whose sheet is open stays lit, so the sheet reads as its detail.
  const [selected, setSelected] = useState<string | null>(null);
  useFocusEffect(useCallback(() => setSelected(null), []));
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const activeSessions = sessions.current;
    return () => {
      activeSessions.forEach((session) => session.dispose());
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  useFocusEffect(() => {
    // Resorting happens on revisit: holds live until the screen loses focus.
    return () => {
      sessions.current.forEach((session) => session.dispose());
      sessions.current.clear();
      setBrowsing(new Map());
      setHighlighted(null);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  });

  const { data: rows } = useQuery<ShopRow>(
    `SELECT i.*, c.name AS category_name, v.ingredient_lines,
            pm.slot_date AS slot_date, pm.meal AS meal
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = i.variant_id
      WHERE i.list_id = ?
      ORDER BY i.status,
               CASE WHEN i.status = 'purchased' THEN i.updated_at END DESC,
               COALESCE(c.sort_order, 999), COALESCE(c.name, 'zzz'), i.name, i.id`,
    [list.id],
  );
  const active = holdPositions(
    rows.filter((item) => item.status === "active"),
    [...browsing.values()].map((held) => held.hold),
  );
  const checked = rows
    .filter((item) => item.status === "purchased")
    .slice(0, 50);

  function clearHighlightLater() {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(
      () => setHighlighted(null),
      HIGHLIGHT_MS,
    );
  }

  function releasePosition(itemId: string) {
    sessions.current.delete(itemId);
    setBrowsing((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    clearHighlightLater();
  }

  function check(id: string) {
    const purchase = () => setItemStatus(id, "purchased");
    return sessions.current.get(id)?.check(purchase) ?? purchase();
  }

  function open(id: string) {
    setSelected(id);
    router.push({ pathname: "/shop/item", params: { itemId: id } });
  }

  function swap(item: ShopRow, direction: 1 | -1) {
    let session = sessions.current.get(item.id);
    if (!session) {
      const options = orderedAlternatives(
        item.name ?? "",
        alternativesForItem(item.name ?? "", item.ingredient_lines),
      );
      if (options.length < 2) return false;
      const hold: HeldPosition = {
        itemId: item.id,
        index: active.findIndex((row) => row.id === item.id),
        categoryId: item.category_id,
        categoryName: item.category_name,
      };
      setBrowsing((current) =>
        new Map(current).set(item.id, {
          options,
          selected: options[0]!,
          hold,
        }),
      );
      session = new SwapSession(options, {
        save: (option) => applySwap(item.id, option),
        change: (option) =>
          setBrowsing((current) => {
            const held = current.get(item.id);
            if (!held) return current;
            return new Map(current).set(item.id, { ...held, selected: option });
          }),
        release: () => releasePosition(item.id),
        error: () => {
          setHighlighted(null);
          Alert.alert("Couldn't swap item", "Please try again.");
        },
      });
      sessions.current.set(item.id, session);
    }
    const index = session.options.indexOf(session.selected);
    const alternative = session.options[index + direction];
    if (!alternative) return false;
    setHighlighted(item.id);
    clearHighlightLater();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    session.select(alternative);
    AccessibilityInfo.announceForAccessibility(
      `Changed to ${alternative.name}`,
    );
    return true;
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
        title: sentenceCase(item.category_name ?? "Uncategorised"),
      });
    }
    entries.push({ key: item.id, kind: "item", item });
  }
  if (checked.length) {
    entries.push({ key: "checked", kind: "header", title: "Checked" });
    for (const item of checked)
      entries.push({ key: item.id, kind: "item", item });
  }

  // Large title collapses only when the ScrollView is the first native
  // child of the screen (expo-router Stack docs). No wrapper View.
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      removeClippedSubviews={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Text variant="muted" className="px-4 pb-1 android:pt-3">
        {active.length === 0
          ? "Nothing on the list. Choose ingredients from your meals or tap + to add an item."
          : `${active.length} to buy${checked.length ? ` · ${checked.length} checked` : ""}`}
      </Text>
      <View className="px-4 pt-3">
        <Button variant="outline" onPress={() => router.push("/shop/meals")}>
          <Text>Choose ingredients from meals</Text>
        </Button>
      </View>
      {entries.map((entry, index) => {
        if (entry.kind === "header") {
          return (
            <Animated.View
              key={entry.key}
              layout={ROW_LAYOUT}
              className="px-4 pb-1.5 pt-6"
            >
              <Text className="text-[13px] font-semibold text-muted-foreground">
                {entry.title}
              </Text>
            </Animated.View>
          );
        }
        return (
          <ShopItemRow
            key={entry.key}
            item={entry.item}
            today={today}
            browse={browsing.get(entry.item.id)}
            highlighted={
              highlighted === entry.item.id || selected === entry.item.id
            }
            divider={entries[index + 1]?.kind === "item"}
            onCheck={check}
            onSwap={swap}
            onOpen={open}
          />
        );
      })}
    </ScrollView>
  );
}
