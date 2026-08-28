import { useQuery } from "@powersync/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type SearchBarCommands } from "react-native-screens";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { addItem } from "@/db/items";
import type { ListItem } from "@/db/schema";

const PLUS_ICON = { ios: "plus.circle", android: "add_circle_outline", web: "add_circle_outline" } as const;

export default function AddItemSheet() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<SearchBarCommands>(null);
  const [draft, setDraft] = useState("");
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  useEffect(() => {
    // autoFocus on the native search bar is Android-only; focus it manually on iOS.
    const t = setTimeout(() => searchRef.current?.focus(), 100);
    return () => clearTimeout(t);
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
      if (activeKey.has(item.name_key)) continue;
      if (needle && !item.name.toLowerCase().includes(needle)) continue;
      seen.add(item.name_key);
      out.push(item);
      if (out.length === 12) break;
    }
    return out;
  }, [history, activeRows, draft]);

  async function pick(name: string) {
    void Haptics.selectionAsync();
    await addItem(listId ?? "", name);
    searchRef.current?.clearText();
  }

  async function submit(text: string) {
    const name = text.trim();
    if (!name) return;
    void Haptics.selectionAsync();
    await addItem(listId ?? "", name);
    searchRef.current?.clearText();
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          variant="done"
          onPress={() => router.back()}
        >
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Stack.SearchBar
        ref={searchRef}
        placeholder="Add an item"
        hideWhenScrolling={false}
        onChangeText={(e) => setDraft(e.nativeEvent.text)}
        onSearchButtonPress={(e) => void submit(e.nativeEvent.text)}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-6 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {suggestions.length > 0 || draft.trim() ? (
          <View className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-background">
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void pick(item.name!)}
                className="flex-row items-center gap-3 px-4 py-3"
              >
                <SymbolView name={PLUS_ICON} tintColor={mutedColor} size={20} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-medium">{item.name}</Text>
                  {item.spec ? (
                    <Text variant="muted" className="text-xs">
                      {item.spec}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}

            {draft.trim() ? (
              <Pressable
                onPress={() => void submit(draft)}
                className="flex-row items-center gap-3 px-4 py-3"
              >
                <SymbolView name={PLUS_ICON} tintColor={mutedColor} size={20} />
                <Text className="text-sm font-medium">{draft.trim()}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
