import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@powersync/react";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { List, Variant } from "@/db/schema";
import { setPlannedMeal } from "@/db/planned-meals";
import { SLOT_LABEL, type MealSlot } from "@/features/meals/slots";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const X_ICON = { ios: "xmark", android: "close", web: "close" } as const;

/** pageSheet, not formSheet: the picker scrolls, and inside a formSheet the
 *  detent measuring pass mangles ScrollView frames (react-native-screens
 *  #3634). Picks a cookbook variant for the slot/date passed via params. */
export default function PickFromCookbookSheet() {
  const { slot, date } = useLocalSearchParams<{ slot: MealSlot; date: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lists } = useQuery<List>("SELECT * FROM lists ORDER BY created_at LIMIT 1");
  const list = lists[0] ?? null;
  const { data: variants } = useQuery<Variant>(
    "SELECT * FROM variants ORDER BY created_at DESC",
  );

  async function onPick(variant: Variant) {
    if (!list || !slot || !date || !variant.recipe_id || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setPlannedMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        recipeId: variant.recipe_id,
        variantId: variant.id,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : "Could not add to plan");
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="size-8 items-center justify-center rounded-full bg-muted"
            >
              <SymbolView name={X_ICON} tintColor={mutedColor} size={15} />
            </Pressable>
          ),
        }}
      />

      <View className="gap-1 px-6 pb-3 pt-4">
        <Text variant="muted" className="text-sm">
          {variants.length
            ? `Tap to plan for ${slot ? SLOT_LABEL[slot].toLowerCase() : ""}`
            : "Your cookbook is empty. Import a recipe to plan from it."}
        </Text>
        {error ? (
          <Text variant="small" className="text-destructive">
            {error}
          </Text>
        ) : null}
      </View>

      {variants.length ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View className="divide-y divide-border/40 border-t border-border/40">
            {variants.map((v) => {
              const meta = [v.recipe_cuisine, v.total_time, v.recipe_yield]
                .filter(Boolean)
                .join(" · ");
              return (
                <Pressable
                  key={v.id}
                  onPress={() => void onPick(v)}
                  className="flex-row items-center gap-4 px-6 py-3 active:bg-accent"
                >
                  {/* Same tonalPair as the cookbook row and hero — one
                      identity per recipe. */}
                  <View className="size-12 overflow-hidden rounded-lg">
                    <LinearGradient
                      colors={tonalPair(v.id, dark)}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={{ flex: 1 }}
                    />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium" numberOfLines={2}>
                      {v.name ?? "…"}
                    </Text>
                    {meta ? (
                      <Text variant="muted" className="text-sm" numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : v.description ? (
                      <Text variant="muted" className="text-sm" numberOfLines={1}>
                        {v.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View className="px-6 pb-8 pt-3">
          <Button
            variant="outline"
            onPress={() =>
              router.replace({
                pathname: "/meals/import",
                params: { slot: slot ?? "", date: date ?? "" },
              } as never)
            }
          >
            <Text>Import a recipe</Text>
          </Button>
        </View>
      )}
    </>
  );
}
