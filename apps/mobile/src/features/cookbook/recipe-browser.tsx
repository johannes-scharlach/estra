import { Link, Stack, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MealSlot } from "@/features/meals/slots";
import { useRecipeChoices } from "./use-recipe-choices";

/** Shared browsing rules and native search for the cookbook and slot picker. */
export function RecipeBrowser({ onSelect, disabled, target, error, onImport }: {
  onSelect?: (variant: Variant) => void;
  disabled?: boolean;
  target?: { date: string; slot: MealSlot };
  error?: string | null;
  onImport: () => void;
}) {
  const [search, setSearch] = useState("");
  const { choices, isLoading } = useRecipeChoices(search);
  const dark = useColorScheme() === "dark";
  const foreground = useResolveClassNames("text-foreground").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    <>
      <Stack.SearchBar
        placeholder="Search recipes"
        tintColor={foreground}
        headerIconColor={foreground}
        textColor={foreground}
        hintTextColor={muted}
        autoCapitalize="none"
        hideWhenScrolling
        onChangeText={(event) => setSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearch("")}
      />
      <FlatList
        className="flex-1 bg-background"
        data={choices}
        keyExtractor={({ variant }) => variant.recipe_id!}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={error ? <Text className="p-6 text-destructive">{error}</Text> : null}
        ListEmptyComponent={isLoading ? <ActivityIndicator className="mt-12" /> : (
          <View className="items-center gap-4 px-6 py-12">
            <Text variant="muted">{search.trim() ? `No matches for “${search.trim()}”.` : "Your cookbook is empty."}</Text>
            {!search.trim() ? <Pressable accessibilityRole="button" onPress={onImport} disabled={disabled}><Text className="text-primary">Import a recipe</Text></Pressable> : null}
          </View>
        )}
        renderItem={({ item: { variant, olderVariant, variantCount } }) => {
          const openVariants = () => router.push({
            pathname: "/variant/versions",
            params: { recipeId: variant.recipe_id!, id: variant.id, ...target },
          });
          const row = (
            <Pressable
              accessibilityRole={target ? "button" : "link"}
              accessibilityLabel={`${target ? "Plan" : "Open"} ${variant.name ?? "recipe"}${olderVariant ? ", older matching variant" : ""}`}
              disabled={disabled}
              onPress={target ? () => onSelect?.(variant) : undefined}
              className="flex-row items-center gap-4 px-6 py-3 active:bg-accent"
            >
              <View className="size-16 overflow-hidden rounded-xl">
                <LinearGradient colors={tonalPair(variant.id, dark)} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ flex: 1 }} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-medium" numberOfLines={2}>{variant.name ?? "…"}</Text>
                <Text variant="muted" className="text-sm" numberOfLines={2}>
                  {[variant.recipe_cuisine, variant.total_time, variant.recipe_yield].filter(Boolean).join(" · ") || variant.description}
                </Text>
                {olderVariant ? <Text className="text-sm text-primary">Older matching variant</Text> : null}
              </View>
            </Pressable>
          );

          if (!target) {
            return (
              <View className="border-b border-border/40">
                <Link
                  href={{ pathname: "/variant/[id]", params: { id: variant.id } }}
                  asChild
                >
                  <Link.Trigger>{row}</Link.Trigger>
                  <Link.Preview />
                  {variantCount > 1 ? (
                    <Link.Menu>
                      <Link.MenuAction
                        title="Other variants"
                        icon="square.stack"
                        onPress={openVariants}
                      />
                    </Link.Menu>
                  ) : null}
                </Link>
              </View>
            );
          }

          return (
            <View className="border-b border-border/40">
              {row}
              {variantCount > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Other variants of ${variant.name}`}
                disabled={disabled}
                onPress={openVariants}
                className="self-start px-6 pb-3 pt-1"
              >
                <Text className="text-sm text-primary">Other variants · {variantCount}</Text>
              </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </>
  );
}
