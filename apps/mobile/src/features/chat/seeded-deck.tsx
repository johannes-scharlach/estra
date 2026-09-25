import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import { ingredientsLine } from "./ingredients-line";
import { SEEDED_ART } from "./seeded-art";
import ideas from "./seeded-ideas.json";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const CLOCK_ICON = { ios: "clock", android: "schedule" } as const;
const THUMB = 56;

type Seeded = (typeof ideas)[number] & {
  months?: number[];
  previewTitle?: string;
  previewIngredients?: string;
};

/** In-season first, out-of-season last, everything else in file order. */
function bySeason(month: number): Seeded[] {
  const rank = (m: Seeded) =>
    !m.months ? 1 : m.months.includes(month) ? 0 : 2;
  return [...(ideas as Seeded[])].sort((a, b) => rank(a) - rank(b));
}

/**
 * The from-nothing path: thirty-odd weeknight meals you can start from
 * without pulling anything out of the fridge. Home previews a few as a
 * grouped list, with the full deck on its own screen. Bundled JSON, not
 * cookbook rows: they are inspiration, and the cookbook only
 * holds what was actually saved. Seasonal ones sit first while their
 * months are on, and last otherwise.
 */
export function SeededDeck({
  onPick,
  preview = false,
}: {
  onPick: (text: string) => void;
  preview?: boolean;
}) {
  const deck = bySeason(new Date().getMonth() + 1);
  function pick(meal: Seeded) {
    const ingredients =
      meal.ingredients.charAt(0).toLowerCase() + meal.ingredients.slice(1);
    onPick(`Let's do ${meal.title} with ${ingredients}.`);
  }

  if (preview) {
    return (
      <View className="overflow-hidden rounded-2xl bg-card">
        {deck.slice(0, 4).map((meal, index) => (
          <View key={meal.title}>
            {index > 0 ? (
              <View
                className="border-t border-border"
                style={{ marginLeft: 16 + THUMB + 12 }}
              />
            ) : null}
            <SeededRow meal={meal} onPick={pick} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-2 pb-4 pt-2">
      {deck.map((meal) => (
        <SeededCard key={meal.title} meal={meal} onPick={pick} />
      ))}
    </View>
  );
}

/** Press feedback is a smoothed bg-card -> bg-accent crossfade, not an instant swap. */
function usePressFade() {
  const pressed = useSharedValue(0);
  const cardBg = useResolveClassNames("bg-card").backgroundColor as string;
  const accentBg = useResolveClassNames("bg-accent").backgroundColor as string;
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.get(),
      [0, 1],
      [cardBg, accentBg],
    ),
  }));
  return {
    style,
    onPressIn: () =>
      pressed.set(withTiming(1, { duration: 120, easing: EASE_OUT })),
    onPressOut: () =>
      pressed.set(withTiming(0, { duration: 120, easing: EASE_OUT })),
  };
}

function SeededRow({
  meal,
  onPick,
}: {
  meal: Seeded;
  onPick: (meal: Seeded) => void;
}) {
  const { style, onPressIn, onPressOut } = usePressFade();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const art = SEEDED_ART[meal.title];

  return (
    <Pressable
      onPress={() => onPick(meal)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
    >
      <Animated.View
        className="flex-row items-center gap-3 px-4 py-3"
        style={style}
      >
        {art ? (
          <Image
            source={art}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            style={{ width: THUMB, height: THUMB, borderRadius: 12 }}
          />
        ) : null}
        <View className="flex-1 gap-0.5">
          <Text
            className="text-[17px] font-semibold leading-snug"
            numberOfLines={1}
          >
            {meal.previewTitle ?? meal.title}
          </Text>
          <IngredientsLine
            ingredients={meal.previewIngredients ?? meal.ingredients}
          />
          <View className="flex-row items-center gap-1">
            <SymbolView name={CLOCK_ICON} tintColor={mutedColor} size={11} />
            <Text variant="muted" className="text-xs">
              {meal.time}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function IngredientsLine({ ingredients }: { ingredients: string }) {
  const [line, setLine] = useState(ingredients);
  return (
    <View>
      <Text variant="muted" className="text-sm" numberOfLines={1}>
        {line}
      </Text>
      {/* Invisible and unclamped: its first line is what fits. */}
      <Text
        variant="muted"
        className="absolute inset-x-0 top-0 text-sm opacity-0"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(e) =>
          setLine(
            ingredientsLine(
              ingredients,
              e.nativeEvent.lines[0]?.text ?? ingredients,
            ),
          )
        }
      >
        {ingredients}
      </Text>
    </View>
  );
}

function SeededCard({
  meal,
  onPick,
}: {
  meal: Seeded;
  onPick: (meal: Seeded) => void;
}) {
  const { style, onPressIn, onPressOut } = usePressFade();

  return (
    <Pressable
      onPress={() => onPick(meal)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
    >
      <Animated.View
        className="gap-1 rounded-2xl border border-border px-4 py-3"
        style={style}
      >
        <Text className="text-base font-semibold leading-snug">
          {meal.title}
        </Text>
        <Text className="text-sm leading-5 text-foreground/80">
          {meal.vibe}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {meal.ingredients}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
