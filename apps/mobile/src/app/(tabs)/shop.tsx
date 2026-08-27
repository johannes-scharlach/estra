import { useQuery, useStatus } from "@powersync/react";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import * as Crypto from "expo-crypto";
import { v5 as uuidv5 } from "uuid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addItem, itemNameKey, setItemStatus } from "@/db/items";
import { useAuth } from "@/db/provider";
import type { List, ListItem, Variant } from "@/db/schema";
import { powersync } from "@/db/system";
import { parseVariant } from "@/db/variants";
import { cn } from "@/lib/utils";

type ActiveRow = ListItem & {
  category_name: string | null;
  sort_order: number | null;
  variant_name: string | null;
  slot_date: string | null;
  meal: string | null;
  variant_id: string | null;
};

export default function Shop() {
  const { session } = useAuth();
  const status = useStatus();
  const { data: lists, isLoading } = useQuery<List>("SELECT * FROM lists ORDER BY created_at");

  if (isLoading)
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );

  const list = lists[0];
  if (!list) {
    return (
      <Centered>
        <Text>No lists yet.</Text>
        <Button onPress={() => void createList("Home", session?.user.id)}>
          <Text>Create one</Text>
        </Button>
      </Centered>
    );
  }

  return <ListScreen list={list} connected={status.connected} />;
}

function ListScreen({ list, connected }: { list: List; connected: boolean }) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<ActiveRow | null>(null);
  const insets = useSafeAreaInsets();
  const iconColor = (useResolveClassNames("text-foreground").color as string) ?? "#000";
  const muted = (useResolveClassNames("text-muted-foreground").color as string) ?? "#888";

  const { data: active } = useQuery<ActiveRow>(
    `SELECT i.*, c.name AS category_name, c.sort_order AS sort_order,
            pm.slot_date AS slot_date, pm.meal AS meal, pm.variant_id AS variant_id, v.name AS variant_name
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = pm.variant_id
      WHERE i.list_id = ? AND i.status = 'active'
      ORDER BY COALESCE(c.sort_order, 999), COALESCE(c.name, 'zzz'), i.name`,
    [list.id],
  );

  const { data: recent } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND status = 'purchased' AND planned_meal_id IS NULL
      ORDER BY purchase_count DESC, updated_at DESC
      LIMIT 20`,
    [list.id],
  );

  const { data: variants } = useQuery<Variant>("SELECT * FROM variants");

  const variantMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof parseVariant>>();
    for (const v of variants) {
      try {
        m.set(v.id, parseVariant(v));
      } catch {
        // invalid JSON — skip, offline sync may be partial
      }
    }
    return m;
  }, [variants]);

  const suggestions = useMemo(() => {
    if (!selected?.variant_id) return [];
    const v = variantMap.get(selected.variant_id);
    if (!v) return [];
    return swapsForItem(selected, v);
  }, [selected, variantMap]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActiveRow[]>();
    for (const item of active) {
      const key = item.category_name ?? "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    // sort groups by sort_order of first item
    return [...map.entries()].sort((a, b) => {
      const ao = a[1][0]?.sort_order ?? 999;
      const bo = b[1][0]?.sort_order ?? 999;
      return ao - bo;
    });
  }, [active]);

  async function submit() {
    await addItem(list.id, draft);
    setDraft("");
  }

  return (
    <View className="flex-1 gap-3 bg-background p-6">
      <View className="flex-row items-baseline justify-between">
        <Text variant="h3">{list.name}</Text>
        <Text variant="muted">{connected ? "synced" : "offline"}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          placeholder="Add an item"
          returnKeyType="done"
        />
        <Button onPress={() => void submit()}>
          <Text>Add</Text>
        </Button>
      </View>

      <ScrollView contentContainerClassName="gap-6 pb-6">
        {grouped.map(([category, items]) => (
          <View key={category} className="gap-2">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{category}</Text>
            <View className="gap-1">
              {items.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <Pressable
                    hitSlop={8}
                    onPress={() => void setItemStatus(item.id, "purchased")}
                    className={cn("size-6 items-center justify-center rounded-md border", item.status === "active" ? "border-input bg-background" : "border-primary bg-primary")}
                  >
                    {/* checkmark */}
                    <SymbolView name="checkmark" tintColor={item.status === "active" ? "transparent" : "white"} size={14} />
                  </Pressable>
                  <Pressable className="flex-1 gap-0.5" onPress={() => setSelected(item)}>
                    <Text className="text-sm font-medium">{item.name}</Text>
                    <View className="flex-row items-center gap-2">
                      {item.spec ? <Text variant="muted" className="text-xs">{item.spec}</Text> : null}
                      {item.variant_name ? (
                        <Text variant="muted" className="text-xs">
                          {item.variant_name}
                          {item.slot_date ? ` · ${item.slot_date} ${item.meal ?? ""}`.trim() : ""}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}

        {active.length === 0 ? <Text variant="muted">Nothing on the list.</Text> : null}

        {recent.length > 0 ? (
          <View className="gap-2 pt-2">
            <Text variant="small" className="font-semibold">Recent</Text>
            <View className="flex-row flex-wrap gap-2">
              {recent.map((item) => (
                <Pressable
                  key={item.id}
                  className="rounded-full border border-border px-3 py-1.5"
                  onPress={() => void setItemStatus(item.id, "active")}
                >
                  <Text variant="small">{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ItemSheet
        key={selected?.id ?? "none"}
        item={selected}
        suggestions={suggestions}
        onClose={() => setSelected(null)}
        mutedColor={muted}
        iconColor={iconColor}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

type SwapSuggestion = {
  id: string;
  from_item_name: string;
  to_item_name: string;
  to_qty_text: string;
  prep_note: string | null;
  category_id: string | null;
  displayName: string;
};

function buildName(line: { qty_text: string | null | undefined; item_name: string }): string {
  const qty = (line.qty_text ?? "").trim();
  return qty ? `${qty} ${line.item_name}`.trim() : line.item_name;
}

function swapsForItem(item: ActiveRow, variant: ReturnType<typeof parseVariant>): SwapSuggestion[] {
  const rawName = item.name ?? "";
  const itemKey = itemNameKey(rawName);
  const lowerItemName = rawName.toLowerCase();

  // first pass: exact key match against rendered name or any swap rendered name
  for (const line of variant.ingredientLines) {
    const originalDisplay = buildName(line);
    const originalKey = itemNameKey(originalDisplay);
    const swapDisplays = (line.swaps ?? []).map((s) => buildName(s));
    const swapKeys = swapDisplays.map((d) => itemNameKey(d));

    const isMatch = itemKey === originalKey || swapKeys.includes(itemKey);
    if (isMatch) {
      const alternatives: { qty_text: string | null; item_name: string; prep_note?: string; category_id?: string }[] = [
        { qty_text: line.qty_text ?? null, item_name: line.item_name, prep_note: line.prep_note, category_id: line.category_id },
        ...(line.swaps ?? []).map((s) => ({ qty_text: s.qty_text ?? null, item_name: s.item_name, prep_note: s.prep_note, category_id: s.category_id })),
      ];
      const out: SwapSuggestion[] = [];
      for (const alt of alternatives) {
        const display = buildName(alt as { qty_text: string | null; item_name: string });
        if (itemNameKey(display) === itemKey) continue;
        out.push({
          id: `${line.item_name}->${alt.item_name}:${display}`,
          from_item_name: line.item_name,
          to_item_name: alt.item_name,
          to_qty_text: alt.qty_text ?? "",
          prep_note: alt.prep_note ?? null,
          category_id: alt.category_id ?? null,
          displayName: display,
        });
      }
      return out.slice(0, 5);
    }
  }

  // fallback: substring match on item_name (handles qty changes after custom edits)
  for (const line of variant.ingredientLines) {
    const needle = line.item_name.toLowerCase();
    if (!lowerItemName.includes(needle)) continue;
    const alternatives: { qty_text: string | null; item_name: string; prep_note?: string; category_id?: string }[] = [
      { qty_text: line.qty_text ?? null, item_name: line.item_name, prep_note: line.prep_note, category_id: line.category_id },
      ...(line.swaps ?? []).map((s) => ({ qty_text: s.qty_text ?? null, item_name: s.item_name, prep_note: s.prep_note, category_id: s.category_id })),
    ];
    const out: SwapSuggestion[] = [];
    for (const alt of alternatives) {
      const display = buildName(alt as { qty_text: string | null; item_name: string });
      if (itemNameKey(display) === itemKey) continue;
      out.push({
        id: `${line.item_name}->${alt.item_name}:${display}`,
        from_item_name: line.item_name,
        to_item_name: alt.item_name,
        to_qty_text: alt.qty_text ?? "",
        prep_note: alt.prep_note ?? null,
        category_id: alt.category_id ?? null,
        displayName: display,
      });
    }
    if (out.length) return out.slice(0, 5);
  }

  return [];
}

function ItemSheet({
  item,
  suggestions,
  onClose,
  mutedColor,
  iconColor,
  bottomInset,
}: {
  item: ActiveRow | null;
  suggestions: SwapSuggestion[];
  onClose: () => void;
  mutedColor: string;
  iconColor: string;
  bottomInset: number;
}) {
  const [edit, setEdit] = useState(item?.name ?? "");
  const [saving, setSaving] = useState(false);

  const currentName = item?.name ?? "";
  const isMealDerived = !!item?.planned_meal_id;

  async function applySwap(s: SwapSuggestion) {
    if (!item) return;
    const trimmed = s.displayName.trim();
    if (!trimmed) return;
    setSaving(true);
    const nameKey = itemNameKey(trimmed);
    await powersync.execute(
      `UPDATE list_items SET name = ?, name_key = ?, spec = ?, category_id = ?, updated_at = ? WHERE id = ?`,
      [trimmed, nameKey, s.prep_note, s.category_id, new Date().toISOString(), item.id],
    );
    setSaving(false);
    onClose();
  }

  async function applyCustom() {
    if (!item) return;
    const trimmed = edit.trim() || currentName.trim();
    if (!trimmed) return;
    setSaving(true);
    const nameKey = itemNameKey(trimmed);
    await powersync.execute(`UPDATE list_items SET name = ?, name_key = ?, updated_at = ? WHERE id = ?`, [
      trimmed,
      nameKey,
      new Date().toISOString(),
      item.id,
    ]);
    setSaving(false);
    onClose();
  }



  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable onPress={() => {}} className="gap-4 rounded-t-2xl bg-card p-6" style={{ paddingBottom: bottomInset + 16 }}>
          {item ? (
            <>
              <View className="gap-1">
                <Text variant="large">{item.name}</Text>
                {isMealDerived ? (
                  <Text variant="muted">
                    From {item.variant_name ?? "meal"} {item.slot_date ? `· ${item.slot_date} ${item.meal ?? ""}` : ""}
                  </Text>
                ) : (
                  <Text variant="muted">Standalone item</Text>
                )}
              </View>

              <View className="flex-row items-center gap-2">
                <Button variant="outline" className="flex-1" onPress={() => void setItemStatus(item.id, "purchased").then(onClose)}>
                  <SymbolView name="checkmark" tintColor={iconColor} size={16} />
                  <Text>Check off</Text>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={async () => {
                    await powersync.execute(`DELETE FROM list_items WHERE id = ?`, [item!.id]);
                    onClose();
                  }}
                >
                  <Text>Remove</Text>
                </Button>
              </View>

              {isMealDerived ? (
                <View className="gap-2">
                  <Text variant="small" className="font-semibold">Swaps</Text>
                  {suggestions.length > 0 ? (
                    <View className="gap-2">
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => void applySwap(s)}
                          className="rounded-xl border border-border px-3 py-2"
                        >
                          <Text className="text-sm">
                            {s.from_item_name} → {s.displayName}
                            {s.prep_note ? `, ${s.prep_note}` : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text variant="muted" className="text-xs">No swaps for this line — try custom below.</Text>
                  )}
                </View>
              ) : null}

              <View className="gap-2">
                <Text variant="small" className="font-semibold">Discuss a swap</Text>
                <Input value={edit} onChangeText={setEdit} placeholder="e.g. no tofu, extra beans" returnKeyType="done" onSubmitEditing={() => void applyCustom()} />
                <Text variant="muted" className="text-xs">Type what you want to change — for now it updates the line directly. LLM rewrite for the whole variant comes next.</Text>
                <Button onPress={() => void applyCustom()} disabled={saving || !edit.trim()}>
                  <Text>{saving ? "…" : "Apply"}</Text>
                </Button>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center gap-3 bg-background p-6">{children}</View>;
}

const ESTRA_NAMESPACE = "6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77";

async function createList(name: string, userId: string | undefined) {
  if (!userId) return;
  const listId = Crypto.randomUUID();
  const now = new Date().toISOString();
  await powersync.writeTransaction(async (tx) => {
    await tx.execute(`INSERT INTO lists (id, name, invite_code, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      listId,
      name,
      Crypto.randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      now,
      now,
    ]);
    await tx.execute(`INSERT INTO list_members (id, list_id, user_id, joined_at) VALUES (?, ?, ?, ?)`, [
      uuidv5(`${listId}:${userId}`, ESTRA_NAMESPACE),
      listId,
      userId,
      now,
    ]);
  });
}
