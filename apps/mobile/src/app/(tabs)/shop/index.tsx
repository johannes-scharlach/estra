import { useQuery } from "@powersync/react";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import ReAnimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setItemStatus } from "@/db/items";
import { createList } from "@/db/lists";
import { useAuth } from "@/db/provider";
import type { List, ListItem } from "@/db/schema";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 380;

const MEAL_ICON = {
  ios: "fork.knife",
  android: "restaurant",
  web: "restaurant",
} as const;
const CHECKED_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
  web: "check_circle",
} as const;
const UNCHECKED_ICON = {
  ios: "circle",
  android: "radio_button_unchecked",
  web: "radio_button_unchecked",
} as const;

type ActiveRow = ListItem & {
  category_name: string | null;
  sort_order: number | null;
};

export default function Shop() {
  const { session } = useAuth();
  const router = useRouter();
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="Add item"
          onPress={() =>
            router.push({ pathname: "/shop/add", params: { listId: list.id } })
          }
        >
          Add
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ListScreen list={list} />
    </>
  );
}

function CheckCircle({
  checked,
  tintColor,
}: {
  checked: boolean;
  tintColor: string | undefined;
}) {
  return (
    <View className="size-6 items-center justify-center">
      <SymbolView
        name={checked ? CHECKED_ICON : UNCHECKED_ICON}
        tintColor={tintColor}
        size={24}
      />
    </View>
  );
}

function ListScreen({ list }: { list: List }) {
  const router = useRouter();
  /** Ids tapped but not yet moved — they render struck-through until the write lands. */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const insets = useSafeAreaInsets();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const [cutoff] = useState(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
    };
  }, []);

  const { data: active } = useQuery<ActiveRow>(
    `SELECT i.*, c.name AS category_name, c.sort_order AS sort_order
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.list_id = ? AND i.status = 'active'
      ORDER BY COALESCE(c.sort_order, 999), COALESCE(c.name, 'zzz'), i.name`,
    [list.id],
  );

  // Recently checked items — used both for quick uncheck and as add-suggestion history.
  const { data: checked } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND status = 'purchased' AND updated_at >= ?
      ORDER BY updated_at DESC
      LIMIT 25`,
    [list.id, cutoff],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ActiveRow[]>();
    for (const item of active) {
      const key = item.category_name ?? "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].sort((a, b) => {
      const ao = a[1][0]?.sort_order ?? 999;
      const bo = b[1][0]?.sort_order ?? 999;
      return ao - bo;
    });
  }, [active]);

  function toggleCheck(id: string) {
    if (pending.has(id)) {
      // Tapped again inside the window — cancel the check-off.
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPending((prev) => new Set(prev).add(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        void setItemStatus(id, "purchased").finally(() => {
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
      }, CHECK_DELAY_MS),
    );
  }

  async function uncheck(id: string) {
    void Haptics.selectionAsync();
    await setItemStatus(id, "active");
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 px-6 pb-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {grouped.map(([category, items]) => (
        <View key={category} className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {category}
            </Text>
          </View>
          <View className="-mx-6 divide-y divide-border/60 border-y border-border/60">
            {items.map((item) => {
              const isPending = pending.has(item.id);
              return (
                <ReAnimated.View
                  key={item.id}
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(120)}
                  layout={LinearTransition.duration(180)}
                >
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/shop/item",
                        params: { itemId: item.id },
                      })
                    }
                    className="flex-row items-center gap-3 px-6 py-3"
                  >
                    <Pressable
                      onPress={() => toggleCheck(item.id)}
                      hitSlop={12}
                    >
                      <CheckCircle
                        checked={isPending}
                        tintColor={
                          isPending
                            ? (primaryColor as string | undefined)
                            : (mutedColor as string | undefined)
                        }
                      />
                    </Pressable>
                    <View className="flex-1 gap-0.5">
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={cn(
                            "text-sm font-medium",
                            isPending &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {item.name}
                        </Text>
                        {item.planned_meal_id ? (
                          <SymbolView
                            name={MEAL_ICON}
                            tintColor={mutedColor}
                            size={12}
                          />
                        ) : null}
                      </View>
                      {item.spec ? (
                        <Text
                          variant="muted"
                          className={cn(
                            "text-xs",
                            isPending && "line-through",
                          )}
                        >
                          {item.spec}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </ReAnimated.View>
              );
            })}
          </View>
        </View>
      ))}

      {active.length === 0 ? (
        <Text variant="muted">Nothing on the list.</Text>
      ) : null}

      {checked.length > 0 ? (
        <View className="gap-2 pt-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Checked
            </Text>
            <Text variant="muted">{checked.length}</Text>
          </View>
          <View className="-mx-6 divide-y divide-border/60 border-y border-border/60">
            {checked.map((item) => (
              <ReAnimated.View
                key={item.id}
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition.duration(180)}
              >
                <Pressable
                  onPress={() => void uncheck(item.id)}
                  className="flex-row items-center gap-3 px-6 py-3"
                >
                  <CheckCircle
                    checked
                    tintColor={primaryColor as string | undefined}
                  />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-medium text-muted-foreground line-through">
                      {item.name}
                    </Text>
                    {item.spec ? (
                      <Text variant="muted" className="text-xs line-through">
                        {item.spec}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </ReAnimated.View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
