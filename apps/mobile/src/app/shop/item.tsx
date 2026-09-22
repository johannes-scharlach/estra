import * as Haptics from "expo-haptics";
import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  applySwap,
  removeItem,
  renameItem,
  setItemCategory,
  setItemStatus,
} from "@/db/items";
import type { ListItem } from "@/db/schema";
import { alternativesForItem } from "@/features/shop/alternatives";
import { CategoryMenu } from "@/features/shop/category-menu";
import { PrimaryAction } from "@/features/variants/primary-action";

/** Row shape: the list item plus its meal provenance, if any. */
type ItemRow = ListItem & {
  slot_date: string | null;
  meal: string | null;
  variant_name: string | null;
  ingredient_lines: string | null;
  category_name: string | null;
};

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so the rename draft is always fresh. Same pattern as variant/plan. */
export default function ShopItemSheet() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();

  const { data: categories } = useQuery<{ id: string; name: string }>(
    "SELECT id, name FROM categories ORDER BY sort_order",
  );

  const { data: rows, isLoading } = useQuery<ItemRow>(
    `SELECT i.*, pm.slot_date AS slot_date, pm.meal AS meal,
            v.name AS variant_name, v.ingredient_lines AS ingredient_lines,
            c.name AS category_name
       FROM list_items i
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = i.variant_id
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.id = ? LIMIT 1`,
    [itemId ?? ""],
  );
  const item = rows[0];

  const suggestions = useMemo(() => {
    if (!item?.variant_id) return [];
    return alternativesForItem(item.name ?? "", item.ingredient_lines)
      .filter((alternative) => alternative.name.trim().toLowerCase() !== item.name?.trim().toLowerCase());
  }, [item]);

  const [edit, setEdit] = useState("");
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <View collapsable={false} className="px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">Loading item…</Text>
          <CloseButton onPress={() => router.back()} />
        </View>
        <ActivityIndicator className="my-6" />
      </View>
    );
  }
  if (!item) {
    return (
      <View collapsable={false} className="gap-1 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">Item not found</Text>
          <CloseButton onPress={() => router.back()} />
        </View>
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
    <View collapsable={false}>
      <View className="gap-1 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">{item.name}</Text>
          <CloseButton onPress={() => router.back()} disabled={saving} />
        </View>
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
                  key={s.name}
                  disabled={saving}
                  onPress={() =>
                    void close(() =>
                      applySwap(item.id, s),
                    )
                  }
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <Text className="text-sm">{item.name} → {s.name}</Text>
                  {[s.qtyText, s.prepNote].filter(Boolean).length > 0 ? (
                    <Text variant="muted" className="text-xs">
                      {[s.qtyText, s.prepNote].filter(Boolean).join(", ")}
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

      <View className="mt-6 gap-2 px-6">
        <Text variant="muted" className="text-xs uppercase tracking-widest">Category</Text>
        <CategoryMenu
          categories={categories}
          categoryId={item.category_id}
          categoryName={item.category_name}
          onSelect={(nextCat) => {
            void setItemCategory(item.id, nextCat);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        />
      </View>

      <View className="mt-6 gap-2 px-6">
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
        <PrimaryAction
          label={saving ? "Applying…" : "Apply"}
          disabled={saving || !edit.trim()}
          onPress={() => void close(() => renameItem(item.id, edit))}
        />
      </View>
    </View>
  );
}
