import { useQuery } from "@powersync/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import ReAnimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addItem } from "@/db/items";
import type { ListItem } from "@/db/schema";
import { cn } from "@/lib/utils";

const ADD_DELAY_MS = 320;

const PLUS_ICON = {
  ios: "plus.circle",
  android: "add_circle_outline",
  web: "add_circle_outline",
} as const;

const CHECKED_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
  web: "check_circle",
} as const;

export default function AddItemSheet() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState("");
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [pendingAdded, setPendingAdded] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const { data: history } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND status = 'purchased' AND planned_meal_id IS NULL
      ORDER BY purchase_count DESC, updated_at DESC
      LIMIT 50`,
    [listId ?? ""],
  );

  const { data: activeRows } = useQuery<{ name_key: string }>(
    `SELECT name_key FROM list_items
      WHERE list_id = ? AND status = 'active' AND planned_meal_id IS NULL`,
    [listId ?? ""],
  );

  const suggestions = useMemo(() => {
    const activeKey = new Set(activeRows.map((i) => i.name_key));
    const seen = new Set<string>();
    const needle = draft.trim().toLowerCase();
    const out: ListItem[] = [];
    for (const item of history) {
      if (!item.name || !item.name_key || seen.has(item.name_key)) continue;
      if (activeKey.has(item.name_key) && !pendingAdded.has(item.id)) continue;
      if (needle && !item.name.toLowerCase().includes(needle)) continue;
      seen.add(item.name_key);
      out.push(item);
      if (out.length === 12) break;
    }
    return out;
  }, [history, activeRows, draft, pendingAdded]);

  const trimmed = draft.trim();
  const hasExactMatch = suggestions.some(
    (item) => item.name?.toLowerCase() === trimmed.toLowerCase(),
  );
  const showDraft = trimmed.length > 0 && !hasExactMatch;

  function flashLastAdded(name: string) {
    setLastAdded(name);
    const t = setTimeout(() => {
      setLastAdded((cur) => (cur === name ? null : cur));
      timers.current.delete(t);
    }, 1800);
    timers.current.add(t);
  }

  async function addCustom(name: string) {
    const itemToAdd = name.trim();
    if (!itemToAdd) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraft("");
    flashLastAdded(itemToAdd);
    await addItem(listId ?? "", itemToAdd);
  }

  function addSuggestion(item: ListItem) {
    if (pendingAdded.has(item.id) || !item.name) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingAdded((prev) => new Set(prev).add(item.id));
    flashLastAdded(item.name);

    const t = setTimeout(() => {
      timers.current.delete(t);
      void addItem(listId ?? "", item.name!).finally(() => {
        setPendingAdded((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      });
    }, ADD_DELAY_MS);
    timers.current.add(t);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              className="px-2 py-1"
            >
              <Text className="text-base font-semibold text-primary">Done</Text>
            </Pressable>
          ),
        }}
      />

      <View className="px-6 pb-2 pt-3">
        <Input
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an item..."
          autoFocus
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
          submitBehavior="submit" // submits without blurring
          onSubmitEditing={() => {
            if (trimmed) void addCustom(trimmed);
          }}
        />
      </View>

      {lastAdded ? (
        <ReAnimated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          className="flex-row items-center gap-1.5 px-6 pb-2 pt-1"
        >
          <SymbolView name={CHECKED_ICON} tintColor={primaryColor} size={14} />
          <Text variant="muted" className="text-xs">
            Added &ldquo;{lastAdded}&rdquo;
          </Text>
        </ReAnimated.View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {showDraft || suggestions.length > 0 ? (
          <View>
            <View className="divide-y divide-border/60 border-t border-border/60">
              {showDraft ? (
                <Pressable
                  onPress={() => void addCustom(trimmed)}
                  className="flex-row items-center gap-3 px-6 py-3 active:bg-accent"
                >
                  <SymbolView
                    name={PLUS_ICON}
                    tintColor={mutedColor}
                    size={20}
                  />
                  <Text className="text-sm font-medium" numberOfLines={1}>
                    Add &ldquo;{trimmed}&rdquo;
                  </Text>
                </Pressable>
              ) : null}

              {suggestions.map((item) => {
                const isPending = pendingAdded.has(item.id);
                return (
                  <ReAnimated.View
                    key={item.id}
                    entering={FadeIn.duration(120)}
                    exiting={FadeOut.duration(120)}
                    layout={LinearTransition.duration(180)}
                  >
                    <Pressable
                      disabled={isPending}
                      onPress={() => addSuggestion(item)}
                      className={cn(
                        "flex-row items-center gap-3 px-6 py-3",
                        !isPending && "active:bg-accent",
                      )}
                    >
                      <SymbolView
                        name={isPending ? CHECKED_ICON : PLUS_ICON}
                        tintColor={
                          isPending
                            ? (primaryColor as string | undefined)
                            : (mutedColor as string | undefined)
                        }
                        size={20}
                      />
                      <View className="flex-1 gap-0.5">
                        <Text
                          className={cn(
                            "text-sm font-medium",
                            isPending && "text-muted-foreground",
                          )}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.spec ? (
                          <Text
                            variant="muted"
                            className="text-xs"
                            numberOfLines={1}
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
        ) : (
          <View className="items-center justify-center px-6 py-12">
            <Text variant="muted" className="text-center text-sm">
              Type an item name above to add it to your list.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
