import * as Haptics from "expo-haptics";
import { useQuery } from "@powersync/react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Children, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import {
  applySwap,
  removeItem,
  renameItem,
  setItemCategory,
  setItemSpec,
  setItemStatus,
} from "@/db/items";
import type { ListItem } from "@/db/schema";
import { slotWhen } from "@/features/meals/slots";
import { alternativesForItem } from "@/features/shop/alternatives";
import { CategoryMenu } from "@/features/shop/category-menu";
import { splitSpec } from "@/features/shop/spec";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { capitalize } from "@/features/shop/text";
import { Action } from "@/components/action";

/** Row shape: the list item plus its meal provenance, if any. */
type ItemRow = ListItem & {
  slot_date: string | null;
  meal: string | null;
  variant_name: string | null;
  ingredient_lines: string | null;
  category_name: string | null;
};

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so drafts are always fresh. Same pattern as variant/plan.
 *  Meal items belong to their recipe: read-only, changed through Swaps.
 *  Standalone items are the user's own: name and note edit in place. */
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
    return alternativesForItem(item.name ?? "", item.ingredient_lines).filter(
      (alternative) =>
        alternative.name.trim().toLowerCase() !==
        item.name?.trim().toLowerCase(),
    );
  }, [item]);

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

  const category = (
    <CategoryMenu
      categories={categories}
      categoryId={item.category_id}
      categoryName={item.category_name}
      onSelect={(nextCat) => {
        void setItemCategory(item.id, nextCat);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    />
  );

  return (
    <View collapsable={false} className="gap-5 px-6 pb-6 pt-4">
      {isMealDerived ? (
        <MealDetails
          item={item}
          category={category}
          onClose={() => router.back()}
          saving={saving}
        />
      ) : (
        <StandaloneDetails
          item={item}
          category={category}
          onClose={() => router.back()}
          saving={saving}
        />
      )}

      {isMealDerived && suggestions.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>Swap for</SectionLabel>
          <Group>
            {suggestions.map((s) => {
              const { amount, note } = splitSpec(
                [s.qtyText, s.prepNote].filter(Boolean).join(", "),
              );
              return (
                <Pressable
                  key={s.name}
                  disabled={saving}
                  onPress={() => void close(() => applySwap(item.id, s))}
                  className="min-h-12 flex-row items-baseline gap-3 px-4 py-3 active:bg-accent"
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base">{capitalize(s.name)}</Text>
                    {note ? <Text variant="muted">{note}</Text> : null}
                  </View>
                  {amount ? (
                    <Text
                      variant="muted"
                      className="text-base"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {amount}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Group>
        </View>
      ) : null}

      <View className="gap-1">
        <Action
          label="Check off"
          disabled={saving}
          onPress={() => void close(() => setItemStatus(item.id, "purchased"))}
        />
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void close(() => removeItem(item.id))}
          className="min-h-11 items-center justify-center rounded-2xl active:bg-accent disabled:opacity-50"
        >
          <Text className="text-base text-destructive">Remove from list</Text>
        </Pressable>
      </View>
    </View>
  );
}

type DetailsProps = {
  item: ItemRow;
  category: React.ReactNode;
  saving: boolean;
  onClose: () => void;
};

/** Meal items show what the recipe asks for, prep included, and lead back to it. */
function MealDetails({ item, category, saving, onClose }: DetailsProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const dark = useColorScheme() === "dark";
  const { amount, note } = splitSpec(item.spec);
  const when = slotWhen(item.slot_date, item.meal);
  return (
    <>
      <HeaderRow onClose={onClose} saving={saving}>
        <Text className="text-2xl font-semibold">
          {capitalize(item.name ?? "")}
        </Text>
        {amount || note ? (
          <Text variant="muted" className="text-base">
            {[amount, note].filter(Boolean).join(", ")}
          </Text>
        ) : null}
      </HeaderRow>
      <Group>
        {item.variant_id ? (
          <Link
            href={{
              pathname: "/variant/[id]",
              params: {
                id: item.variant_id,
                plannedMealId: item.planned_meal_id ?? undefined,
              },
            }}
            dismissTo={Platform.OS === "ios"}
            asChild
          >
            <Pressable
              disabled={saving}
              accessibilityHint="Opens the recipe"
              className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-base" numberOfLines={2}>
                  {item.variant_name ?? "Recipe"}
                </Text>
                {when ? (
                  // Same dot as the List row, so the colour means this recipe.
                  <View className="flex-row items-center gap-1.5">
                    <View
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: tonalPair(item.variant_id, dark)[1],
                      }}
                    />
                    <Text variant="muted">For {when}</Text>
                  </View>
                ) : null}
              </View>
              <SymbolView
                name={{ ios: "chevron.right", android: "chevron_right" }}
                tintColor={mutedColor}
                size={14}
              />
            </Pressable>
          </Link>
        ) : null}
        {category}
      </Group>
    </>
  );
}

/** Standalone items are the user's own words: name and note edit in place,
 *  saved on blur, laid out like a Reminders detail. The note is free text,
 *  never parsed. */
function StandaloneDetails({ item, category, saving, onClose }: DetailsProps) {
  const [name, setName] = useState(item.name ?? "");
  const [note, setNote] = useState(item.spec ?? "");

  function save(action: () => Promise<void>, revert: () => void) {
    action().catch(() => {
      revert();
      Alert.alert("Couldn't save item", "Please try again.");
    });
  }

  return (
    <>
      <HeaderRow onClose={onClose} saving={saving}>
        <Text className="text-2xl font-semibold">Details</Text>
      </HeaderRow>
      <Group>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Name"
          placeholder="Name"
          returnKeyType="done"
          editable={!saving}
          // No line height: on iOS it shifts single-line input text down.
          className="h-12 px-4 text-[17px] text-foreground placeholder:text-muted-foreground/70"
          onEndEditing={() => {
            if (!name.trim()) return setName(item.name ?? "");
            if (name.trim() !== item.name)
              save(
                () => renameItem(item.id, name),
                () => setName(item.name ?? ""),
              );
          }}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          accessibilityLabel="Note"
          placeholder="Add a note"
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          editable={!saving}
          className="min-h-12 px-4 py-3 text-[16px] text-muted-foreground placeholder:text-muted-foreground/70"
          onEndEditing={() => {
            if (note.trim() !== (item.spec ?? ""))
              save(
                () => setItemSpec(item.id, note),
                () => setNote(item.spec ?? ""),
              );
          }}
        />
      </Group>
      <Group>{category}</Group>
    </>
  );
}

/** Title block with the close button, shared by both kinds of item. */
function HeaderRow({
  children,
  saving,
  onClose,
}: {
  children: React.ReactNode;
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <View className="flex-row items-start gap-4">
      <View className="flex-1 gap-1 pt-1.5">{children}</View>
      <CloseButton onPress={onClose} disabled={saving} />
    </View>
  );
}

/** iOS grouped section: one card, hairlines between rows. */
function Group({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <View className="ml-4 border-t border-border" /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-[13px] font-semibold text-muted-foreground">
      {children}
    </Text>
  );
}
