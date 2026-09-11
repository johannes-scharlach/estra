import { useQuery } from "@powersync/react";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const PLUS_ICON = { ios: "plus", android: "add", web: "add" } as const;

function VariantRow({
  variant,
  dark,
  onPress,
}: {
  variant: Variant;
  dark: boolean;
  onPress: () => void;
}) {
  const meta = [
    variant.recipe_cuisine,
    variant.total_time,
    variant.recipe_yield,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 px-6 py-3 active:bg-accent"
    >
      {/* Same tonalPair as the recipe hero — one identity per recipe. */}
      <View className="size-16 overflow-hidden rounded-xl">
        <LinearGradient
          colors={tonalPair(variant.id, dark)}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium" numberOfLines={2}>
          {variant.name ?? "…"}
        </Text>
        {meta ? (
          <Text variant="muted" className="text-sm" numberOfLines={1}>
            {meta}
          </Text>
        ) : variant.description ? (
          <Text variant="muted" className="text-sm" numberOfLines={1}>
            {variant.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function Cookbook() {
  const router = useRouter();
  const scheme = useColorScheme();
  const iconColor = useResolveClassNames("text-foreground").color;
  const hintColor = useResolveClassNames("text-muted-foreground").color;

  const [search, setSearch] = useState("");
  const query = search.trim();

  const like = `%${query}%`;
  const { data: variants, isLoading } = useQuery<Variant>(
    `SELECT * FROM variants
      WHERE name LIKE ? OR recipe_cuisine LIKE ? OR recipe_category LIKE ?
      ORDER BY created_at DESC`,
    [like, like, like],
  );

  const empty = !isLoading && variants.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/cookbook/import" as never)}
              accessibilityLabel="Import recipe"
              accessibilityRole="button"
              className="size-12 items-center justify-center"
            >
              <SymbolView name={PLUS_ICON} tintColor={iconColor} size={24} />
            </Pressable>
          ),
        }}
      />

      <Stack.SearchBar
        placeholder="Search recipes"
        tintColor={iconColor}
        headerIconColor={iconColor}
        textColor={iconColor}
        hintTextColor={hintColor}
        autoCapitalize="none"
        hideWhenScrolling
        onChangeText={(event) => setSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearch("")}
      />

      {/* ScrollView must be the first native child for the large title to collapse. */}
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {isLoading ? (
          <View className="mt-6 gap-3 px-6">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-row items-center gap-4 py-3">
                <Skeleton className="size-16 rounded-xl" />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </View>
              </View>
            ))}
          </View>
        ) : empty && query ? (
          <View className="mt-12 items-center px-6">
            <Text variant="muted">No matches for “{query}”.</Text>
          </View>
        ) : empty ? (
          <View className="mt-16 items-center gap-4 px-6">
            <Text variant="muted" className="text-center">
              Your cookbook is empty. Import a recipe from a URL to start
              cooking from it.
            </Text>
            <Button onPress={() => router.push("/cookbook/import" as never)}>
              <Text>Import a recipe</Text>
            </Button>
          </View>
        ) : (
          <View className="mt-4 divide-y divide-border/60">
            {variants.map((v) => (
              <VariantRow
                key={v.id}
                variant={v}
                dark={scheme === "dark"}
                onPress={() => router.push(`/variant/${v.id}` as never)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
