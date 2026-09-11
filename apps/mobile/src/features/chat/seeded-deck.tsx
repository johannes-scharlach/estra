import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";

import { Text } from "@/components/ui/text";

import ideas from "./seeded-ideas.json";

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
  const cardWidth = Math.min(300, width - 76);
  const deck = bySeason(new Date().getMonth() + 1);
  function pick(meal: Seeded) {
    const ingredients = meal.ingredients.charAt(0).toLowerCase() + meal.ingredients.slice(1);
    onPick(`Let's do ${meal.title} with ${ingredients}.`);
  }

  const cards = (preview ? deck.slice(0, 6) : deck).map((meal) => (
    <Pressable
      key={meal.title}
      onPress={() => pick(meal)}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
      style={preview ? { width: cardWidth } : undefined}
      className="gap-1 rounded-2xl border border-border bg-card px-4 py-3 active:bg-accent"
    >
      <Text className="text-base font-semibold leading-snug">
        {preview ? meal.previewTitle ?? meal.title : meal.title}
      </Text>
      <Text className="text-sm leading-5 text-foreground/80">{preview ? meal.time : meal.vibe}</Text>
      <Text variant="muted" numberOfLines={preview ? 2 : 1}>
        {preview ? meal.previewIngredients ?? meal.ingredients : meal.ingredients}
      </Text>
    </Pressable>
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
