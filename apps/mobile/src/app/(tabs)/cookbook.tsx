import { useQuery } from "@powersync/react";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const BAR_H = 44;
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
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const iconColor = useResolveClassNames("text-foreground").color;

  const [search, setSearch] = useState("");
  const query = search.trim();

  const [scrollY] = useState(() => new Animated.Value(0));
  const [smallTitleOpacity] = useState(() =>
    scrollY.interpolate({
      inputRange: [28, 48],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
  );
  const [largeTitleOpacity] = useState(() =>
    scrollY.interpolate({
      inputRange: [0, 32],
      outputRange: [1, 0],
      extrapolate: "clamp",
    }),
  );

  const like = `%${query}%`;
  const { data: variants, isLoading } = useQuery<Variant>(
    `SELECT * FROM variants
      WHERE name LIKE ? OR recipe_cuisine LIKE ? OR recipe_category LIKE ?
      ORDER BY created_at DESC`,
    [like, like, like],
  );

  const empty = !isLoading && variants.length === 0;

  return (
    <View className="flex-1 bg-background">
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={{
          paddingTop: insets.top + BAR_H,
          paddingBottom: 40,
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: largeTitleOpacity }} className="px-6 pt-2">
          <Text className="text-4xl font-bold tracking-tight">Cookbook</Text>
        </Animated.View>

        <View className="mt-4 px-6">
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search recipes"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

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
          <View className="mt-4 divide-y divide-border/60 border-y border-border/60">
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
      </Animated.ScrollView>

      <View
        style={{ paddingTop: insets.top }}
        className="absolute inset-x-0 top-0 z-10 bg-background"
      >
        <View className="h-11 flex-row items-center justify-between px-6">
          <Animated.View style={{ opacity: smallTitleOpacity }}>
            <Text className="text-lg font-semibold">Cookbook</Text>
          </Animated.View>
          <Pressable
            hitSlop={12}
            onPress={() => router.push("/cookbook/import" as never)}
            className="p-2"
          >
            <SymbolView name={PLUS_ICON} tintColor={iconColor} size={24} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
