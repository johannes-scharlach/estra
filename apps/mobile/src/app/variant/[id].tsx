import { useQuery } from "@powersync/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorValue } from "react-native";
import { Linking, Pressable, Share, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import type { Variant, Recipe } from "@/db/schema";
import type { IngredientLine } from "@/db/schemas";
import { parseVariant } from "@/db/variants";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const HERO_HEIGHT = 420;

const SHARE_ICON = {
  ios: "square.and.arrow.up",
  android: "share",
  web: "share",
} as const;
const TIME_ICON = {
  ios: "clock",
  android: "schedule",
  web: "schedule",
} as const;
const SERVES_ICON = {
  ios: "person.2",
  android: "group",
  web: "group",
} as const;
const ADD_PLAN_ICON = {
  ios: "calendar.badge.plus",
  android: "calendar_add_on",
  web: "calendar_add_on",
} as const;
const SWAP_ICON = {
  ios: "arrow.left.arrow.right",
  android: "swap_horiz",
  web: "swap_horiz",
} as const;
const COOK_ICON = {
  ios: "fork.knife",
  android: "restaurant",
  web: "restaurant",
} as const;

type SwapDirection = "next" | "prev";

function IngredientRow({
  line,
  idx,
  activeIdx,
  onSwap,
  mutedColor,
}: {
  line: IngredientLine;
  idx: number;
  activeIdx: number | undefined;
  onSwap: (idx: number, direction: SwapDirection) => void;
  mutedColor: ColorValue | undefined;
}) {
  const translateX = useSharedValue(0);
  const swaps = line.swaps ?? [];
  const display =
    activeIdx !== undefined && swaps[activeIdx] ? swaps[activeIdx] : line;
  const isSwapped = activeIdx !== undefined;

  const animateSwap = useCallback(
    (direction: SwapDirection) => {
      const target = direction === "next" ? -28 : 28;
      translateX.value = withSequence(
        withTiming(target, { duration: 100 }),
        withTiming(0, { duration: 200 }),
      );
    },
    // translateX is a stable shared value; it must not be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const triggerSwap = useCallback(
    (direction: SwapDirection) => {
      animateSwap(direction);
      onSwap(idx, direction);
    },
    [animateSwap, idx, onSwap],
  );

  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onUpdate((event) => {
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = event.translationX * 0.5;
    })
    .onEnd((event) => {
      const threshold = 40;
      if (event.translationX < -threshold) {
        runOnJS(triggerSwap)("next");
      } else if (event.translationX > threshold) {
        runOnJS(triggerSwap)("prev");
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withTiming(0, { duration: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const body = (
    <>
      <View className="flex-1 flex-row flex-wrap items-baseline gap-x-1 gap-y-0.5 pr-3">
        {display.qty_text ? (
          <Text className="font-semibold">{display.qty_text}</Text>
        ) : null}
        <Text className={isSwapped ? "text-primary" : "text-foreground"}>
          {display.item_name}
        </Text>
        {display.prep_note ? (
          <Text variant="muted" className="text-sm">
            — {display.prep_note}
          </Text>
        ) : null}
        {isSwapped ? (
          <Text variant="muted" className="text-xs">
            swapped
          </Text>
        ) : null}
      </View>
      {swaps.length ? (
        <Pressable
          onPress={() => triggerSwap("next")}
          hitSlop={12}
          className="p-2"
        >
          <SymbolView name={SWAP_ICON} tintColor={mutedColor} size={18} />
        </Pressable>
      ) : null}
    </>
  );

  // Rows without swaps get no gesture — a full-bleed pan at the left edge
  // would fight the iOS back swipe for nothing.
  if (!swaps.length) {
    return (
      <View className="flex-row items-center justify-between px-6 py-3">
        {body}
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className="flex-row items-center justify-between px-6 py-3"
        style={animatedStyle}
      >
        {body}
      </Animated.View>
    </GestureDetector>
  );
}

export default function VariantPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const foreground = useResolveClassNames("text-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const primaryForegroundColor = useResolveClassNames(
    "text-primary-foreground",
  ).color;
  const secondaryForegroundColor = useResolveClassNames(
    "text-secondary-foreground",
  ).color;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Header background + title fade in together as the hero scrolls away, so
  // controls are always themed-on-surface or themed-on-pastel — never white
  // text on a light blur.
  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT - 80, HERO_HEIGHT - 40],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    return { opacity };
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-200, 0], [1.4, 1], {
      extrapolateLeft: "extend",
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(scrollY.value, [0, HERO_HEIGHT], [0, -40], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { transform: [{ scale }, { translateY }] as const };
  });

  useEffect(() => {
    void activateKeepAwakeAsync();
    return () => {
      void deactivateKeepAwake();
    };
  }, []);

  const { data: variants, isLoading } = useQuery<Variant>(
    "SELECT * FROM variants WHERE id = ? LIMIT 1",
    [id ?? ""],
  );
  const variant = variants[0];

  const recipeId = variant?.recipe_id ?? "";
  const { data: recipes } = useQuery<Recipe>(
    "SELECT * FROM recipes WHERE id = ? LIMIT 1",
    [recipeId],
  );
  const recipe = recipes[0];

  // Damaged synced JSON must not crash the screen — show the error state.
  const parsed = useMemo(() => {
    if (!variant) return null;
    try {
      return parseVariant(variant);
    } catch {
      return null;
    }
  }, [variant]);
  const parseFailed = !!variant && !parsed;
  const ingredientLines = useMemo(
    () => parsed?.ingredientLines ?? [],
    [parsed],
  );
  const instructions = useMemo(() => parsed?.instructions ?? [], [parsed]);

  const [activeSwaps, setActiveSwaps] = useState<Record<number, number>>({});

  const handleSwap = useCallback(
    (idx: number, direction: SwapDirection) => {
      const line = ingredientLines[idx];
      const swaps = line?.swaps ?? [];
      if (!swaps.length) return;

      void Haptics.selectionAsync();
      setActiveSwaps((prev) => {
        const cur = prev[idx] ?? -1;
        let next: number;
        if (direction === "next") {
          next = cur + 1 >= swaps.length ? -1 : cur + 1;
        } else {
          next = cur - 1;
          if (next < -1) next = swaps.length - 1;
        }
        if (next === -1) {
          const copy = { ...prev };
          delete copy[idx];
          return copy;
        }
        return { ...prev, [idx]: next };
      });
    },
    [ingredientLines],
  );

  const onShare = useCallback(async () => {
    void Haptics.selectionAsync();
    const message = [variant?.name, variant?.description, recipe?.from_url]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ message });
    } catch {
      // share sheet cancelled or unavailable — ignore
    }
  }, [variant?.name, variant?.description, recipe?.from_url]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
        <Skeleton style={{ height: HERO_HEIGHT }} className="w-full" />
        <View className="gap-3 p-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </View>
      </View>
    );
  }

  if (!variant || parseFailed) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text variant="h3" className="mb-2">
          {parseFailed ? "Couldn't display recipe" : "Recipe not found"}
        </Text>
        <Text variant="muted" className="mb-6 text-center">
          {parseFailed
            ? "The synced data for this recipe looks damaged."
            : "This recipe has not synced yet."}
        </Text>
        <Button onPress={() => router.back()}>
          <Text>Go back</Text>
        </Button>
      </View>
    );
  }

  const colors = tonalPair(variant.id, scheme === "dark");
  const eyebrow = [variant.recipe_cuisine, variant.recipe_category]
    .filter(Boolean)
    .join(" · ");
  const stats = [
    variant.total_time
      ? { icon: TIME_ICON, label: "Time", value: variant.total_time }
      : null,
    variant.recipe_yield
      ? { icon: SERVES_ICON, label: "Serves", value: variant.recipe_yield }
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  const fromDomain = (() => {
    try {
      return recipe?.from_url
        ? new URL(recipe.from_url).hostname.replace(/^www\./, "")
        : "";
    } catch {
      return "";
    }
  })();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: variant.name ?? "Recipe",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
          headerTintColor: foreground as string | undefined,
          headerShadowVisible: false,
          headerBackground: () => (
            <Animated.View
              style={[StyleSheet.absoluteFill, headerStyle]}
              className="border-b border-border/40 bg-background"
            />
          ),
          headerTitle: () => (
            <Animated.View style={headerStyle}>
              <Text
                numberOfLines={1}
                className="max-w-55 text-base font-semibold"
              >
                {variant.name}
              </Text>
            </Animated.View>
          ),
          headerRight: () => (
            <Pressable
              onPress={onShare}
              hitSlop={12}
              className="items-center justify-center p-2"
            >
              <SymbolView name={SHARE_ICON} tintColor={foreground} size={22} />
            </Pressable>
          ),
        }}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[{ height: HERO_HEIGHT }, heroAnimatedStyle]}
          className="w-full overflow-hidden"
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{ flex: 1 }}
          >
            <View
              className="flex-1 items-center justify-center gap-3 px-8"
              style={{ paddingTop: insets.top + 56 }}
            >
              {eyebrow ? (
                <Text className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/60">
                  {eyebrow}
                </Text>
              ) : null}
              <Text className="text-center text-4xl font-bold tracking-tight">
                {variant.name}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* One continuous surface over the hero — structure comes from type
            hierarchy and hairlines, not nested cards. */}
        <View className="-mt-7 gap-10 rounded-t-[28px] bg-background px-6 pt-8">
          {variant.description ? (
            <Text variant="lead" className="text-center">
              {variant.description}
            </Text>
          ) : null}

          {stats.length ? (
            <View className="flex-row border-y border-border/60 py-4">
              {stats.map((s, i) => (
                <View
                  key={s.label}
                  className={`flex-1 items-center gap-1 px-4 ${i > 0 ? "border-l border-border/60" : ""}`}
                >
                  <SymbolView
                    name={s.icon}
                    tintColor={primaryColor}
                    size={20}
                  />
                  <Text
                    variant="muted"
                    className="text-[11px] uppercase tracking-widest"
                  >
                    {s.label}
                  </Text>
                  <Text className="text-center font-semibold" numberOfLines={2}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {recipe?.from_name || recipe?.from_url ? (
            <View className="items-center">
              <Text
                variant="muted"
                className="text-xs uppercase tracking-widest"
              >
                Adapted from
              </Text>
              {recipe.from_url ? (
                <Pressable
                  onPress={() => void Linking.openURL(recipe.from_url!)}
                  hitSlop={8}
                >
                  <Text className="mt-0.5 text-sm font-semibold text-primary">
                    {recipe.from_name && recipe.from_name !== recipe.from_url
                      ? recipe.from_name
                      : fromDomain || recipe.from_name}
                  </Text>
                </Pressable>
              ) : (
                <Text className="mt-0.5 text-sm font-semibold">
                  {recipe.from_name}
                </Text>
              )}
            </View>
          ) : null}

          {ingredientLines.length > 0 ? (
            <View className="gap-1">
              <View className="flex-row items-baseline justify-between pb-2">
                <Text variant="h3">Ingredients</Text>
                <Text variant="muted">{ingredientLines.length} items</Text>
              </View>
              <View className="-mx-6 divide-y divide-border/60 border-y border-border/60">
                {ingredientLines.map((line, idx) => (
                  <IngredientRow
                    key={idx}
                    line={line}
                    idx={idx}
                    activeIdx={activeSwaps[idx]}
                    onSwap={handleSwap}
                    mutedColor={mutedColor}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {instructions.length > 0 ? (
            <View className="gap-6">
              <View className="flex-row items-center justify-between">
                <Text variant="h3">Steps</Text>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: "/variant/cook",
                      params: { id: variant.id },
                    })
                  }
                >
                  <SymbolView
                    name={COOK_ICON}
                    tintColor={secondaryForegroundColor}
                    size={16}
                  />
                  <Text className="text-secondary-foreground">Cook</Text>
                </Button>
              </View>
              <View className="gap-8">
                {instructions.map((step, idx) => (
                  <View key={idx} className="gap-2">
                    <View className="flex-row items-baseline gap-3">
                      <Text className="text-base font-bold text-primary">
                        {String(idx + 1).padStart(2, "0")}
                      </Text>
                      {step.name ? (
                        <Text className="flex-1 text-lg font-semibold">
                          {step.name}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="leading-relaxed">{step.text}</Text>
                    {step.tip ? (
                      <View className="mt-1 border-l-2 border-primary/30 pl-3">
                        <Text variant="muted" className="italic">
                          Tip: {step.tip}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {parsed?.content_markdown ? (
            <View className="gap-3">
              <Text variant="h3">Story</Text>
              <EnrichedMarkdownText markdown={parsed.content_markdown} />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: 16, bottom: 16 + insets.bottom }}
      >
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onPress={() =>
            router.push({
              pathname: "/variant/plan",
              params: { id: variant.id },
            })
          }
        >
          <SymbolView
            name={ADD_PLAN_ICON}
            tintColor={primaryForegroundColor}
            size={20}
          />
          <Text className="font-semibold text-primary-foreground">
            Add to plan
          </Text>
        </Button>
      </View>
    </View>
  );
}
