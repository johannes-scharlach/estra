import { itemNameKey, mealDelta, mealSync } from "@estra/meals";
import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { MenuView } from "@expo/ui/community/menu";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorValue } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Keyboard,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { applySwap, setItemStatus } from "@/db/items";
import { useAuth } from "@/db/provider";
import type { List, ListItem, PlannedMeal, Variant, Recipe } from "@/db/schema";
import { parseVariant } from "@/db/variants";
import { Composer } from "@/features/chat/composer";
import { adjustRecipeMessage } from "@/features/chat/compose";
import type { ImageAttachment } from "@/features/chat/image-attachment";
import { queueMessage } from "@/features/chat/message-queue";
import { eatersLabel, parseEaterIds, toEaters } from "@/features/meals/eaters";
import { dateKey } from "@/features/meals/slots";
import {
  driftLabel,
  mealLabel,
  shoppedLabel,
  variantMeals,
} from "@/features/meals/variant-meals";
import {
  adjacentAlternative,
  alternativesForLine,
  type Alternative,
} from "@/features/shop/alternatives";
import { prettyQuantity } from "@/features/shop/spec";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const HERO_HEIGHT = 320;
// Two 22-point icons with 8-point padding on each side.
const HEADER_ACTIONS_WIDTH = 76;
/** How far above the composer the scroll-edge fade runs before it is full. */
const FADE_RUN = 40;

const SHARE_ICON = {
  ios: "square.and.arrow.up",
  android: "share",
  web: "share",
} as const;
const MENU_ICON = {
  ios: "ellipsis.circle",
  android: "more_vert",
  web: "more_horiz",
} as const;
// The list's state of each line, as a leading checklist column: the same
// shapes the shop page uses, so bought / to buy / dropped read at a glance.
const BOUGHT_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
  web: "check_circle",
} as const;
const TO_BUY_ICON = {
  ios: "circle",
  android: "radio_button_unchecked",
  web: "radio_button_unchecked",
} as const;
const MISSING_ICON = {
  ios: "minus.circle",
  android: "do_not_disturb_on",
  web: "do_not_disturb_on",
} as const;

/** What the shopping list says about a line; null when the recipe is not
 *  planned and there is no list to consult. */
type ListState = "bought" | "toBuy" | "missing" | null;

/** The tick is the shop page's control, not a decoration: tapping it marks
 *  the item bought or not, so the pantry check ("do I have this?") happens
 *  here with the recipe in view. A dropped line has nothing to toggle. */
function ListStateIcon({
  state,
  onToggle,
  mutedColor,
  primaryColor,
}: {
  state: ListState;
  onToggle?: () => void;
  mutedColor: ColorValue | undefined;
  primaryColor: ColorValue | undefined;
}) {
  if (!state) return null;
  const name =
    state === "bought"
      ? BOUGHT_ICON
      : state === "toBuy"
        ? TO_BUY_ICON
        : MISSING_ICON;
  const icon = (
    <SymbolView
      name={name}
      tintColor={state === "bought" ? primaryColor : mutedColor}
      size={20}
    />
  );
  if (state === "missing" || !onToggle) {
    return (
      <View className="w-9 pt-3" accessibilityLabel="Not on the list">
        {icon}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 24, right: 8 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === "bought" }}
      accessibilityLabel={state === "bought" ? "Bought" : "Still to buy"}
      className="w-9 pt-3 active:opacity-60"
    >
      {icon}
    </Pressable>
  );
}
const CHEVRON_ICON = {
  ios: "chevron.right",
  android: "chevron_right",
  web: "chevron_right",
} as const;
// The system's popup-button glyph: this value has a menu of choices.
const POPUP_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
  web: "unfold_more",
} as const;
// A line the list swapped: the recipe's steps still name the original.
const SWAPPED_ICON = {
  ios: "arrow.triangle.2.circlepath",
  android: "swap_horiz",
  web: "swap_horiz",
} as const;
const OPEN_LINK_ICON = {
  ios: "arrow.up.forward",
  android: "open_in_new",
  web: "open_in_new",
} as const;

type SwapDirection = "next" | "prev";

/** The first sentence of a blurb, for the clamped view; null if that is
 *  the whole blurb already. */
function firstSentence(text: string): string | null {
  const match = text.match(/^[^.!?]+[.!?]/);
  if (!match || match[0].trim().length >= text.trim().length) return null;
  return match[0];
}

/** One ingredient row as it should read right now: the recipe line, or the
 *  swap that replaced it, plus what the shopping list says about it. */
type RowModel = {
  qtyText: string | null;
  name: string;
  prepNote: string | null;
  /** The recipe's own line when a swap replaced it. */
  swappedFrom: string | null;
  list: ListState;
  /** The list item behind this line, when planned and still on the list. */
  itemId: string | null;
  /** Everything the recipe allows here, its own line first, when the row
   *  can still change. Empty once the item is bought: the list is settled
   *  then. */
  options: Alternative[];
};

function IngredientRow({
  row,
  idx,
  last,
  onSwap,
  onPick,
  onToggle,
  mutedColor,
  primaryColor,
}: {
  row: RowModel;
  idx: number;
  last: boolean;
  onSwap: (idx: number, direction: SwapDirection) => void;
  onPick: (idx: number, alternative: Alternative) => void;
  onToggle: (itemId: string, bought: boolean) => void;
  mutedColor: ColorValue | undefined;
  primaryColor: ColorValue | undefined;
}) {
  const missing = row.list === "missing";
  const canSwap = row.options.length > 1;
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // The line flips like a card: the old text leaves the way the finger
  // went, the new one comes in from the other side. The content itself
  // changes a moment later, while the text is out of view.
  const animateSwap = useCallback(
    (direction: SwapDirection) => {
      const out = direction === "next" ? -56 : 56;
      translateX.value = withSequence(
        withTiming(out, { duration: 120 }),
        withTiming(-out, { duration: 0 }),
        withTiming(0, { duration: 220 }),
      );
      opacity.value = withSequence(
        withTiming(0, { duration: 120 }),
        withTiming(1, { duration: 220 }),
      );
    },
    // Shared values are stable; they must not be dependencies.
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

  // Only the words move; the tick is the list's state and stays put.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const nameClass = `shrink ${
    row.swappedFrom
      ? "text-primary"
      : missing
        ? "text-muted-foreground"
        : "text-foreground"
  }`;
  const currentKey = itemNameKey(row.name);
  // A swapped name is tinted and carries the swap glyph: the change must
  // read without colour too.
  const name = (
    <View className="flex-row items-center gap-1">
      <Text className={nameClass}>{row.name}</Text>
      {row.swappedFrom ? (
        <SymbolView
          name={SWAPPED_ICON}
          tintColor={primaryColor}
          size={12}
          accessibilityLabel={`swapped from ${row.swappedFrom}`}
        />
      ) : null}
    </View>
  );

  const body = (
    <>
      <ListStateIcon
        state={row.list}
        onToggle={
          row.itemId
            ? () => onToggle(row.itemId!, row.list === "bought")
            : undefined
        }
        mutedColor={mutedColor}
        primaryColor={primaryColor}
      />
      {/* The hairline belongs to the text column, inset past the tick as
          system grouped lists inset past their leading glyph. */}
      <View
        className={`flex-1 py-2.5 ${last ? "" : "border-b border-border/70"}`}
      >
        <Animated.View className="gap-0.5" style={animatedStyle}>
          <View className="flex-row flex-wrap items-baseline gap-x-1.5">
            {row.qtyText ? (
              <Text
                className={
                  missing
                    ? "font-semibold text-muted-foreground"
                    : "font-semibold"
                }
              >
                {prettyQuantity(row.qtyText)}
              </Text>
            ) : null}
            {canSwap ? (
              // A popup button, as Settings shows a value with choices: the
              // name and the system's up-down chevron open a menu of what
              // the recipe allows here. A swapped name is tinted; the menu's
              // title says what the recipe had.
              <MenuView
                // The host sizes itself to the label once; a longer name
                // after a swap would be clipped, so a new name is a new host.
                key={row.name}
                title={row.swappedFrom ? `Recipe: ${row.swappedFrom}` : ""}
                actions={row.options.map((option) => ({
                  id: option.name,
                  title: option.name,
                  state: itemNameKey(option.name) === currentKey ? "on" : "off",
                }))}
                onPressAction={({ nativeEvent: { event } }) => {
                  const option = row.options.find((o) => o.name === event);
                  if (option && itemNameKey(option.name) !== currentKey) {
                    onPick(idx, option);
                  }
                }}
              >
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${row.name}, choose an alternative`}
                  className="flex-row items-center gap-1"
                >
                  {name}
                  <SymbolView
                    name={POPUP_ICON}
                    tintColor={mutedColor}
                    size={11}
                  />
                </View>
              </MenuView>
            ) : (
              name
            )}
            {missing ? (
              <Text variant="muted" className="text-sm">
                not on the list
              </Text>
            ) : null}
          </View>
          {row.prepNote ? (
            <Text variant="muted" className="text-sm">
              {row.prepNote}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </>
  );

  const rowClass = "flex-row items-start";

  // Rows without swaps get no gesture — a full-bleed pan at the left edge
  // would fight the iOS back swipe for nothing.
  if (!canSwap) {
    return <View className={rowClass}>{body}</View>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className={rowClass}>{body}</Animated.View>
    </GestureDetector>
  );
}

/** One row of a grouped section. A chevron means it pushes a screen; an
 *  action row is a tinted label instead, as in system grouped lists. */
function SectionRow({
  onPress,
  label,
  detail,
  first,
  trailing,
  disabled,
  accessibilityLabel,
  mutedColor,
}: {
  onPress: () => void;
  label: string;
  detail?: string;
  first?: boolean;
  trailing?: "chevron" | "spinner";
  disabled?: boolean;
  accessibilityLabel?: string;
  mutedColor: ColorValue | undefined;
}) {
  const navigates = trailing === "chevron";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className={`pl-4 active:opacity-60 ${disabled ? "opacity-50" : ""}`}
    >
      {/* The hairline starts at the text and runs to the group's edge, as
          a system inset-grouped list draws it. */}
      <View
        className={`min-h-12 flex-row items-center gap-3 py-2.5 pr-4 ${
          first ? "" : "border-t border-border/70"
        }`}
      >
        <View className="flex-1 gap-0.5">
          <Text
            className={
              navigates
                ? detail
                  ? "font-semibold"
                  : ""
                : "font-medium text-primary"
            }
          >
            {label}
          </Text>
          {detail ? <Text variant="muted">{detail}</Text> : null}
        </View>
        {trailing === "spinner" ? (
          <ActivityIndicator />
        ) : navigates ? (
          <SymbolView name={CHEVRON_ICON} tintColor={mutedColor} size={14} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function VariantPage() {
  const { id, plannedMealId } = useLocalSearchParams<{
    id: string;
    plannedMealId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Android's custom-title container can extend underneath headerRight. Bound
  // it to the toolbar's 56-point back slot, action group and 16-point end inset.
  const headerTitleMaxWidth =
    process.env.EXPO_OS === "android"
      ? Math.max(
          0,
          windowWidth -
            insets.left -
            insets.right -
            56 -
            HEADER_ACTIONS_WIDTH -
            16,
        )
      : undefined;
  const scheme = useColorScheme();
  const { session } = useAuth();
  const foreground = useResolveClassNames("text-foreground").color;
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  // The token is a hex, so an alpha suffix gives its transparent end.
  const background =
    typeof backgroundColor === "string" ? backgroundColor : "#000000";
  const primaryColor = useResolveClassNames("text-primary").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const actionColor = useResolveClassNames("text-primary-foreground").color;
  const reducedMotion = useReducedMotion();
  const [composerHeight, setComposerHeight] = useState(96);
  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at LIMIT 1",
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Header background + title fade in together as the hero scrolls away, so
  // controls are always themed-on-surface or themed-on-pastel — never white
  // text on a light blur.
  // A short crossfade: a half-transparent bar over half-visible rows looked
  // like a rendering fault at arbitrary scroll positions.
  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT - 64, HERO_HEIGHT - 52],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    return { opacity };
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {};

    const scale = interpolate(scrollY.value, [-200, 0], [1.4, 1], {
      extrapolateLeft: "extend",
      extrapolateRight: "clamp",
    });
    // Counter some of the ScrollView's upward movement so the hero recedes
    // behind the faster-moving content sheet instead of outrunning it.
    const translateY = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT],
      [0, HERO_HEIGHT * 0.24],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    return { transform: [{ translateY }, { scale }] as const };
  });

  const heroContentAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_HEIGHT * 0.55],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    return { opacity };
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

  // Every meal on this recipe: this version's, and its siblings' (spec 0004).
  const { data: meals, isLoading: mealsLoading } = useQuery<PlannedMeal>(
    "SELECT * FROM planned_meals WHERE variant_id = ? OR recipe_id = ?",
    [id ?? "", recipeId],
  );
  const {
    selected: meal,
    sibling,
    lastPast,
  } = useMemo(
    () =>
      variantMeals(meals, {
        variantId: id ?? "",
        plannedMealId,
        today: dateKey(new Date()),
      }),
    [meals, id, plannedMealId],
  );
  const { data: items, isFetching: itemsFetching } = useQuery<ListItem>(
    "SELECT * FROM list_items WHERE planned_meal_id = ?",
    [meal?.id ?? ""],
  );
  const { data: peopleRows, isFetching: peopleFetching } = useQuery<{
    id: string;
    name: string;
    user_id: string | null;
  }>(
    "SELECT id, name, user_id FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [meal?.list_id ?? ""],
  );
  // The meal's items and people arrive a render after the meal itself.
  // Drawing before then shows the rows without their list column and the
  // eaters as "Nobody", then jumps; so the skeleton holds until the first
  // fetch for this meal is in. Later refetches (a tick toggled) don't hold.
  const [loadedMealId, setLoadedMealId] = useState<string | null>(null);
  const mealId = meal?.id ?? null;
  const mealReady = !mealId || loadedMealId === mealId;
  if (mealId && !mealReady && !itemsFetching && !peopleFetching) {
    setLoadedMealId(mealId);
  }
  const people = useMemo(
    () => toEaters(peopleRows, session?.user.id),
    [peopleRows, session],
  );

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

  // Not planned: swaps are a preview and live here only.
  const [activeSwaps, setActiveSwaps] = useState<Record<number, number>>({});
  // The blurb is clamped; a tap opens it.
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  // Planned: the shopping list says what each line is right now.
  const delta = useMemo(
    () => mealDelta(ingredientLines, meal ? items : []),
    [ingredientLines, items, meal],
  );
  // Does the recipe still describe the meal? Swaps the list made since,
  // and who the adjust route sized it for (spec 0004).
  const sync = useMemo(
    () =>
      meal
        ? mealSync(
            parsed?.sizedFor ?? null,
            {
              eater_ids: parseEaterIds(meal.eater_ids),
              extra_portions: meal.extra_portions ?? 0,
            },
            delta,
          )
        : null,
    [meal, parsed, delta],
  );

  const rows = useMemo(
    (): RowModel[] =>
      ingredientLines.map((line, idx) => {
        if (!meal) {
          const activeIdx = activeSwaps[idx];
          const swap =
            activeIdx !== undefined ? line.swaps?.[activeIdx] : undefined;
          const display = swap ?? line;
          return {
            qtyText: display.qty_text,
            name: display.item_name,
            prepNote: display.prep_note ?? null,
            swappedFrom: swap ? line.item_name : null,
            list: null,
            itemId: null,
            options: alternativesForLine(line),
          };
        }
        const state = delta.lines[idx];
        const display = state?.swap ?? line;
        const bought = state?.item?.status === "purchased";
        return {
          qtyText: display.qty_text,
          name: display.item_name,
          prepNote: display.prep_note ?? null,
          swappedFrom: state?.swap ? line.item_name : null,
          list: bought ? "bought" : state?.item ? "toBuy" : "missing",
          itemId: state?.item?.id ?? null,
          options: state?.item && !bought ? alternativesForLine(line) : [],
        };
      }),
    [ingredientLines, meal, activeSwaps, delta],
  );

  // Same write as the shop page's checkbox; the watched query re-renders.
  const handleToggle = useCallback((itemId: string, bought: boolean) => {
    setItemStatus(itemId, bought ? "active" : "purchased").catch(() =>
      Alert.alert("Couldn't update item", "Please try again."),
    );
  }, []);

  const handlePick = useCallback(
    (idx: number, alternative: Alternative) => {
      const line = ingredientLines[idx];
      if (!line) return;
      if (meal) {
        const item = delta.lines[idx]?.item;
        if (!item || item.status === "purchased") return;
        // Same write as the shop page: the list is the record of swaps.
        applySwap(item.id, alternative).catch(() =>
          Alert.alert("Couldn't swap item", "Please try again."),
        );
        return;
      }
      const swapIdx = (line.swaps ?? []).findIndex(
        (s) => itemNameKey(s.item_name) === itemNameKey(alternative.name),
      );
      setActiveSwaps((prev) => {
        const copy = { ...prev };
        if (swapIdx < 0) delete copy[idx];
        else copy[idx] = swapIdx;
        return copy;
      });
    },
    [ingredientLines, meal, delta],
  );

  const handleSwap = useCallback(
    (idx: number, direction: SwapDirection) => {
      const line = ingredientLines[idx];
      if (!line) return;

      if (meal) {
        const item = delta.lines[idx]?.item;
        if (!item || item.status === "purchased") return;
        const next = adjacentAlternative(
          item.name ?? "",
          alternativesForLine(line),
          direction === "next" ? 1 : -1,
        );
        if (!next) return;
        // Same write as the shop page: the list is the record of swaps.
        applySwap(item.id, next).catch(() =>
          Alert.alert("Couldn't swap item", "Please try again."),
        );
        return;
      }

      const swaps = line.swaps ?? [];
      if (!swaps.length) return;
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
    [ingredientLines, meal, delta],
  );

  const conversationListId = meal?.list_id ?? lists[0]?.id;
  const startChat = (text: string, attachments: ImageAttachment[] = []) => {
    if (!variant || !recipeId || !conversationListId) return;
    const chatId = Crypto.randomUUID();
    queueMessage({
      chatId,
      listId: conversationListId,
      messageId: Crypto.randomUUID(),
      text,
      attachments,
      recipeContext: {
        variantId: variant.id,
        recipeId,
        plannedMealId: meal?.id,
        previewSwaps: meal ? undefined : activeSwaps,
      },
    });
    Keyboard.dismiss();
    router.push({ pathname: "/chats/[id]", params: { id: chatId } });
  };

  const onShare = useCallback(async () => {
    const message = [variant?.name, variant?.description, recipe?.from_url]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ message });
    } catch {
      // share sheet cancelled or unavailable — ignore
    }
  }, [variant?.name, variant?.description, recipe?.from_url]);

  if (isLoading || mealsLoading || !mealReady) {
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
  // The fade is full from the composer's top edge down.
  const fadeHeight = composerHeight + FADE_RUN;
  // For a planned meal the yield is not up here: sizing is judged against
  // the meal, in the meal group, so there is no second copy to disagree with.
  const meta = [
    variant.total_time,
    meal ? null : variant.recipe_yield,
    variant.recipe_cuisine || variant.recipe_category,
  ]
    .filter(Boolean)
    // The dot is tied to the fact after it, so a wrap never leaves it
    // dangling at the end of a line.
    .join(" · ");
  const blurbLead = variant.description
    ? firstSentence(variant.description)
    : null;

  const fromDomain = (() => {
    try {
      return recipe?.from_url
        ? new URL(recipe.from_url).hostname.replace(/^www\./, "")
        : "";
    } catch {
      return "";
    }
  })();

  const openPlan = () =>
    router.push({ pathname: "/variant/plan", params: { id: variant.id } });
  const openCook = () =>
    router.push({ pathname: "/variant/cook", params: { id: variant.id } });
  const openEaters = () => {
    if (!meal?.list_id || !meal.slot_date || !meal.meal) return;
    router.push({
      pathname: "/meals/eaters",
      params: {
        listId: meal.list_id,
        date: meal.slot_date,
        slot: meal.meal,
        variantId: variant.id,
        eaterIds: JSON.stringify(parseEaterIds(meal.eater_ids)),
        extraPortions: String(meal.extra_portions ?? 0),
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: variant.name ?? "Recipe",
          headerTintColor: foreground as string | undefined,
          headerBackground: () => (
            <Animated.View
              style={[StyleSheet.absoluteFill, headerStyle]}
              className="border-b border-border/40 bg-background"
            />
          ),
          headerTitle: () => (
            <Animated.View
              style={[headerStyle, { maxWidth: headerTitleMaxWidth }]}
              className="min-w-0 shrink px-2"
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className={`text-base font-semibold ${process.env.EXPO_OS === "ios" ? "text-center" : "text-left"}`}
              >
                {variant.name}
              </Text>
            </Animated.View>
          ),
          // Share stays a direct control; the menu holds the rare actions.
          headerRight: () => (
            <View
              style={{ width: HEADER_ACTIONS_WIDTH }}
              className="flex-row items-center"
            >
              <Pressable
                onPress={() => void onShare()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share"
                className="items-center justify-center p-2"
              >
                <SymbolView
                  name={SHARE_ICON}
                  tintColor={foreground}
                  size={22}
                />
              </Pressable>
              <MenuView
                actions={[
                  {
                    id: "history",
                    title: "Chat history",
                    image: "bubble.left.and.bubble.right",
                  },
                  { id: "variants", title: "Variants", image: "square.stack" },
                  ...(meal
                    ? [
                        {
                          id: "plan",
                          title: "Plan this again",
                          image: "calendar.badge.plus" as const,
                        },
                      ]
                    : []),
                ]}
                onPressAction={({ nativeEvent: { event } }) => {
                  if (event === "plan") openPlan();
                  if (event === "history")
                    router.push({
                      pathname: "/chats/history",
                      params: { recipeId, listId: conversationListId },
                    });
                  if (event === "variants")
                    router.push({
                      pathname: "/variant/versions",
                      params: { recipeId, id: variant.id },
                    });
                }}
              >
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="More"
                  className="items-center justify-center p-2"
                >
                  <SymbolView
                    name={MENU_ICON}
                    tintColor={foreground}
                    size={22}
                  />
                </View>
              </MenuView>
            </View>
          ),
        }}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: composerHeight + 40,
        }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
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
            <Animated.View
              className="flex-1 justify-end gap-2 px-6 pb-6"
              style={[
                { paddingTop: insets.top + 56 },
                heroContentAnimatedStyle,
              ]}
            >
              <Text className="text-4xl font-bold tracking-tight">
                {variant.name}
              </Text>
              {meta ? (
                <Text className="text-[15px] text-foreground/70">{meta}</Text>
              ) : null}
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* The wash ends and the page continues on the same surface, as an
            App Store or Music header does. No sheet: that is a modal idiom.
            Structure comes from type and hairlines, not cards; the only
            grouped section is the planned meal. */}
        <View className="gap-8 bg-background px-6 pt-6">
          {/* The meal's facts next to the recipe's. Nothing is computed for
              the user; both are visible and the human judges (spec 0004). */}
          {meal && sync ? (
            <View className="rounded-2xl bg-secondary">
              <SectionRow
                first
                onPress={openEaters}
                accessibilityLabel="Who is eating"
                label={mealLabel(meal)}
                detail={eatersLabel({
                  people,
                  eaterIds: parseEaterIds(meal.eater_ids),
                  extraPortions: meal.extra_portions ?? 0,
                })}
                trailing="chevron"
                mutedColor={mutedColor}
              />
              {/* The second row is the recipe's standing against the meal:
                  in sync, a plain statement; otherwise the drift, with the
                  action that resolves it. */}
              {sync.inSync ? (
                <View className="pl-4">
                  <View className="min-h-12 justify-center border-t border-border/70 py-2.5 pr-4">
                    <Text variant="muted">Adjusted for this meal</Text>
                  </View>
                </View>
              ) : (
                <SectionRow
                  onPress={() =>
                    startChat(
                      adjustRecipeMessage({
                        date: meal.slot_date ?? "",
                        meal: meal.meal ?? "meal",
                        people,
                        eaterIds: parseEaterIds(meal.eater_ids),
                        extraPortions: meal.extra_portions ?? 0,
                        swaps: delta.lines
                          .filter((line) => line.swap && line.item)
                          .map((line) => ({
                            from: line.line.item_name,
                            to: line.item!.name ?? "",
                          })),
                      }),
                    )
                  }
                  disabled={!conversationListId}
                  label="Adjust the recipe"
                  detail={driftLabel(sync, variant.recipe_yield)}
                  mutedColor={mutedColor}
                />
              )}
            </View>
          ) : null}

          {sibling?.variant_id ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/variant/[id]",
                  params: {
                    id: sibling.variant_id!,
                    plannedMealId: sibling.id,
                  },
                })
              }
              accessibilityRole="link"
              className="flex-row items-center gap-1"
            >
              <Text variant="muted" className="text-base">
                {sibling.id === plannedMealId
                  ? `${mealLabel(sibling)} now uses another version`
                  : `Another version is planned for ${mealLabel(sibling)}`}
              </Text>
              <SymbolView
                name={CHEVRON_ICON}
                tintColor={mutedColor}
                size={12}
              />
            </Pressable>
          ) : null}

          {!meal && !sibling && lastPast ? (
            <Text variant="muted" className="text-base">
              Last planned {mealLabel(lastPast)}
            </Text>
          ) : null}

          {variant.description || recipe?.from_name || recipe?.from_url ? (
            <View className="gap-2">
              {variant.description ? (
                <Pressable
                  onPress={() => setDescriptionOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    descriptionOpen ? "Show less" : "Show full description"
                  }
                >
                  {/* Clamped at a sentence, never mid-word, with the
                      disclosure inline as the system does it. */}
                  <Text className="text-[15px] leading-5 text-muted-foreground">
                    {blurbLead && !descriptionOpen
                      ? blurbLead
                      : variant.description}
                    {blurbLead ? (
                      <Text className="text-[15px] font-medium text-primary">
                        {descriptionOpen ? "  less" : "  more"}
                      </Text>
                    ) : null}
                  </Text>
                </Pressable>
              ) : null}
              {recipe?.from_name || recipe?.from_url ? (
                <View className="flex-row flex-wrap items-baseline gap-x-1">
                  <Text variant="muted">Adapted from</Text>
                  {recipe.from_url ? (
                    <Pressable
                      onPress={() => void Linking.openURL(recipe.from_url!)}
                      hitSlop={8}
                      accessibilityRole="link"
                      className="flex-row items-center gap-0.5"
                    >
                      <Text className="text-sm font-semibold text-primary">
                        {recipe.from_name &&
                        recipe.from_name !== recipe.from_url
                          ? recipe.from_name
                          : fromDomain || recipe.from_name}
                      </Text>
                      {/* Says it leaves the app, as Safari's link glyph does. */}
                      <SymbolView
                        name={OPEN_LINK_ICON}
                        tintColor={primaryColor}
                        size={10}
                      />
                    </Pressable>
                  ) : (
                    <Text className="text-sm font-semibold">
                      {recipe.from_name}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {ingredientLines.length > 0 ? (
            <View>
              {/* The caption names what the ticks below mean. It sits under
                  the heading, not in the trailing slot: that slot is where a
                  section's action goes, and this is a status. */}
              <View className="gap-0.5 pb-2">
                <Text variant="h3">Ingredients</Text>
                {meal ? (
                  <Text variant="muted" className="text-sm">
                    {shoppedLabel(items)}
                  </Text>
                ) : null}
              </View>
              <View>
                {rows.map((row, idx) => (
                  <IngredientRow
                    key={idx}
                    row={row}
                    idx={idx}
                    last={idx === rows.length - 1}
                    onSwap={handleSwap}
                    onPick={handlePick}
                    onToggle={handleToggle}
                    mutedColor={mutedColor}
                    primaryColor={primaryColor}
                  />
                ))}
              </View>
              {meal && delta.extra.length > 0 ? (
                <View className="pt-5">
                  <Text variant="muted" className="pb-1">
                    Also on the list
                  </Text>
                  {delta.extra.map((item) => (
                    <View key={item.id} className="flex-row items-start">
                      <ListStateIcon
                        state={item.status === "purchased" ? "bought" : "toBuy"}
                        onToggle={() =>
                          handleToggle(item.id, item.status === "purchased")
                        }
                        mutedColor={mutedColor}
                        primaryColor={primaryColor}
                      />
                      <View className="flex-1 gap-0.5 py-2.5">
                        <Text>{item.name}</Text>
                        {item.spec ? (
                          <Text variant="muted">{item.spec}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {instructions.length > 0 ? (
            <View className="gap-5">
              <Text variant="h3">Steps</Text>
              <View className="gap-6">
                {instructions.map((step, idx) => (
                  // The number sits in the same column as the ticks above,
                  // so the page keeps one left rail from top to bottom.
                  <View key={idx} className="flex-row">
                    <Text
                      variant="muted"
                      className="w-9 text-base font-semibold tabular-nums"
                    >
                      {idx + 1}
                    </Text>
                    <View className="flex-1 gap-1">
                      {step.name ? (
                        <Text className="font-semibold">{step.name}</Text>
                      ) : null}
                      <Text className="leading-6">{step.text}</Text>
                      {step.tip ? (
                        <Text variant="muted" className="mt-1 text-base">
                          Tip: {step.tip}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* The recipe fades beneath the floating composer. Its measured height
          also reserves room for the last step, attachments and multiline text. */}
      <LinearGradient
        colors={[`${background}00`, `${background}BF`, `${background}BF`]}
        locations={[0, FADE_RUN / fadeHeight, 1]}
        style={{
          pointerEvents: "none",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: fadeHeight,
        }}
      />

      <KeyboardStickyView
        style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
        offset={{ closed: 0, opened: insets.bottom }}
      >
        <View
          onLayout={(event) =>
            setComposerHeight(event.nativeEvent.layout.height)
          }
        >
          <Composer
            floating
            placeholder="Ask about this recipe"
            busy={!conversationListId}
            suggestions={[]}
            onSend={startChat}
            emptyAction={
              <Pressable
                onPress={meal ? openCook : openPlan}
                accessibilityRole="button"
                accessibilityLabel={meal ? "Cook" : "Add to plan"}
                className="size-12 items-center justify-center rounded-full bg-primary active:opacity-70"
              >
                <SymbolView
                  name={
                    meal
                      ? { ios: "frying.pan", android: "skillet" }
                      : {
                          ios: "calendar.badge.plus",
                          android: "event_available",
                        }
                  }
                  size={22}
                  tintColor={actionColor}
                />
              </Pressable>
            }
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
