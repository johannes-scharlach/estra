import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import ideas from "./seeded-ideas.json";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Seeded = (typeof ideas)[number] & {
  months?: number[];
  previewTitle?: string;
  previewIngredients?: string;
};

/** In-season first, out-of-season last, everything else in file order. */
function bySeason(month: number): Seeded[] {
  const rank = (m: Seeded) => (!m.months ? 1 : m.months.includes(month) ? 0 : 2);
  return [...(ideas as Seeded[])].sort((a, b) => rank(a) - rank(b));
}

/**
 * The from-nothing path: thirty-odd weeknight meals you can start from
 * without pulling anything out of the fridge. Home previews a few, with
 * the full deck on its own screen. Bundled JSON, not cookbook rows:
 * they are inspiration, and the cookbook only
 * holds what was actually saved. Seasonal ones sit first while their
 * months are on, and last otherwise.
 */
export function SeededDeck({ onPick, preview = false }: {
  onPick: (text: string) => void;
  preview?: boolean;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 44;
  const deck = bySeason(new Date().getMonth() + 1);
  function pick(meal: Seeded) {
    const ingredients = meal.ingredients.charAt(0).toLowerCase() + meal.ingredients.slice(1);
    onPick(`Let's do ${meal.title} with ${ingredients}.`);
  }

  const cards = (preview ? deck.slice(0, 6) : deck).map((meal) => (
    <SeededCard
      key={meal.title}
      meal={meal}
      preview={preview}
      cardWidth={cardWidth}
      onPick={pick}
    />
  ));

  return preview ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      snapToInterval={cardWidth + 12}
      snapToAlignment="start"
      decelerationRate="fast"
      contentContainerClassName="gap-3 px-5"
    >
      {cards}
    </ScrollView>
  ) : (
    <View className="gap-2 pb-4 pt-2">{cards}</View>
  );
}

/** Press feedback is a smoothed bg-card -> bg-accent crossfade, not an instant swap. */
function SeededCard({
  meal,
  preview,
  cardWidth,
  onPick,
}: {
  meal: Seeded;
  preview: boolean;
  cardWidth: number;
  onPick: (meal: Seeded) => void;
}) {
  const pressed = useSharedValue(0);
  const cardBg = useResolveClassNames("bg-card").backgroundColor as string;
  const accentBg = useResolveClassNames("bg-accent").backgroundColor as string;
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.get(), [0, 1], [cardBg, accentBg]),
  }));

  return (
    <Pressable
      onPress={() => onPick(meal)}
      onPressIn={() => pressed.set(withTiming(1, { duration: 120, easing: EASE_OUT }))}
      onPressOut={() => pressed.set(withTiming(0, { duration: 120, easing: EASE_OUT }))}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
      style={preview ? { width: cardWidth } : undefined}
    >
      <Animated.View className="gap-1 rounded-2xl border border-border px-4 py-3" style={style}>
        <Text className="text-base font-semibold leading-snug">
          {preview ? meal.previewTitle ?? meal.title : meal.title}
        </Text>
        <Text className="text-sm leading-5 text-foreground/80">
          {preview ? meal.time : meal.vibe}
        </Text>
        <Text variant="muted" numberOfLines={preview ? 2 : 1}>
          {preview ? meal.previewIngredients ?? meal.ingredients : meal.ingredients}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
