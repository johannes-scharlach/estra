import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  applySwap,
  itemNameKey,
  removeItem,
  renameItem,
  setItemStatus,
} from "@/db/items";
import { parseIngredientLines } from "@/db/variants";
import type { IngredientLine } from "@/db/schemas";
import type { ListItem } from "@/db/schema";

/** Row shape: the list item plus its meal provenance, if any. */
type ItemRow = ListItem & {
  slot_date: string | null;
  meal: string | null;
  variant_name: string | null;
  ingredient_lines: string | null;
};

type SwapSuggestion = {
  id: string;
  to_qty_text: string;
  prep_note: string | null;
  category_id: string | null;
  displayName: string;
};

function swapsForItem(name: string, lines: IngredientLine[]): SwapSuggestion[] {
  // Names are clean (no qty prefix — see planned-meals.ts), so the match is
  // against the ingredient's item_name, not a rendered qty string.
  const itemKey = itemNameKey(name);
  const out: SwapSuggestion[] = [];

  for (const [idx, line] of lines.entries()) {
    const alternatives = [
      { qty_text: line.qty_text ?? null, item_name: line.item_name, prep_note: line.prep_note, category_id: line.category_id },
      ...(line.swaps ?? []).map((s) => ({ qty_text: s.qty_text ?? null, item_name: s.item_name, prep_note: s.prep_note, category_id: s.category_id })),
    ];
    if (!alternatives.some((a) => itemNameKey(a.item_name) === itemKey)) continue;

    for (const alt of alternatives) {
      if (itemNameKey(alt.item_name) === itemKey) continue;
      out.push({
        id: `${idx}:${line.item_name}->${alt.item_name}`,
        to_qty_text: alt.qty_text ?? "",
        prep_note: alt.prep_note ?? null,
        category_id: alt.category_id ?? null,
        displayName: alt.item_name,
      });
    }
  }

  return out.slice(0, 5);
}

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so the rename draft is always fresh. Same pattern as variant/plan. */
export default function ShopItemSheet() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();

  const { data: rows, isLoading } = useQuery<ItemRow>(
    `SELECT i.*, pm.slot_date AS slot_date, pm.meal AS meal,
            v.name AS variant_name, v.ingredient_lines AS ingredient_lines
       FROM list_items i
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = i.variant_id
      WHERE i.id = ? LIMIT 1`,
    [itemId ?? ""],
  );
  const item = rows[0];

  const suggestions = useMemo(() => {
    if (!item?.variant_id) return [];
    try {
      return swapsForItem(item.name ?? "", parseIngredientLines(item.ingredient_lines));
    } catch {
      // invalid JSON — partial sync; no swaps to offer
      return [];
    }
  }, [item]);

  const [edit, setEdit] = useState("");
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <View className="items-center justify-center p-12">
        <ActivityIndicator />
      </View>
    );
  }
  if (!item) {
    return (
      <View className="gap-1 px-6 pt-4 pb-8">
        <Text className="text-lg font-semibold">Item not found</Text>
        <Text variant="muted">It may have been removed on another device.</Text>
      </View>
    );
  }

  const isMealDerived = !!item.planned_meal_id;
  const provenance = isMealDerived
    ? ["From " + (item.variant_name ?? "meal"), item.slot_date, item.meal]
        .filter(Boolean)
        .join(" · ")
    : "Standalone item";

  async function close(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaving(false);
    }
  }

  return (
    <>
      {/* Sections are direct children of the screen root: react-native-screens
          #3634 — inside a formSheet, ScrollView frames get mangled unless the
          scroll view is a direct subview of the content wrapper. */}
      <View className="gap-1 px-6 pt-4">
        <Text className="text-lg font-semibold">{item.name}</Text>
        {item.spec ? <Text variant="muted" className="text-sm">{item.spec}</Text> : null}
        <Text variant="muted" className="text-sm">{provenance}</Text>
      </View>

      <View className="mt-6 flex-row gap-2 px-6">
        <Button
          variant="outline"
          className="flex-1"
          disabled={saving}
          onPress={() => void close(() => setItemStatus(item.id, "purchased"))}
        >
          <Text>Check off</Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={saving}
          onPress={() => void close(() => removeItem(item.id))}
        >
          <Text>Remove</Text>
        </Button>
      </View>

      {isMealDerived ? (
        <View className="mt-6 gap-2 px-6">
          <Text variant="muted" className="text-xs uppercase tracking-widest">Swaps</Text>
          {suggestions.length > 0 ? (
            <View className="gap-2">
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  disabled={saving}
                  onPress={() =>
                    void close(() =>
                      applySwap(item.id, {
                        name: s.displayName,
                        qtyText: s.to_qty_text || null,
                        prepNote: s.prep_note,
                        categoryId: s.category_id,
                      }),
                    )
                  }
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <Text className="text-sm">{item.name} → {s.displayName}</Text>
                  {[s.to_qty_text, s.prep_note].filter(Boolean).length > 0 ? (
                    <Text variant="muted" className="text-xs">
                      {[s.to_qty_text, s.prep_note].filter(Boolean).join(", ")}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text variant="muted" className="text-xs">No swaps for this line.</Text>
          )}
        </View>
      ) : null}

      <View className="mt-6 gap-2 px-6 pb-8">
        <Text variant="muted" className="text-xs uppercase tracking-widest">Rename</Text>
        <Input
          value={edit}
          onChangeText={setEdit}
          placeholder={item.name ?? ""}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!saving && edit.trim()) void close(() => renameItem(item.id, edit));
          }}
        />
        <Button
          size="lg"
          disabled={saving || !edit.trim()}
          onPress={() => void close(() => renameItem(item.id, edit))}
        >
          {saving ? <ActivityIndicator /> : <Text>Apply</Text>}
        </Button>
      </View>
    </>
  );
}
