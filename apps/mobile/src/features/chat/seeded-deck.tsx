import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";

import ideas from "./seeded-ideas.json";

type Seeded = (typeof ideas)[number] & { months?: number[] };

/** In-season first, out-of-season last, everything else in file order. */
function bySeason(month: number): Seeded[] {
  const rank = (m: Seeded) => (!m.months ? 1 : m.months.includes(month) ? 0 : 2);
  return [...(ideas as Seeded[])].sort((a, b) => rank(a) - rank(b));
}

/**
 * The from-nothing path: a fresh chat opens on thirty-odd weeknight meals
 * you can start from without pulling anything out of the fridge. Bundled
 * JSON, not cookbook rows — they are inspiration, and the cookbook only
 * holds what was actually saved (ADR 9). Seasonal ones sit first while
 * their months are on, and last otherwise.
 */
export function SeededDeck({ onPick }: { onPick: (text: string) => void }) {
  const deck = bySeason(new Date().getMonth() + 1);
  function pick(meal: Seeded) {
    void Haptics.selectionAsync();
    const ingredients = meal.ingredients.charAt(0).toLowerCase() + meal.ingredients.slice(1);
    onPick(`Let's do ${meal.title} with ${ingredients}.`);
  }

  return (
    <View className="gap-4 pb-4">
      <View className="gap-1 pt-2">
        <Text className="text-2xl font-semibold tracking-tight">What are we cooking?</Text>
        <Text variant="muted" className="text-base">
          Tell me two or three things you have, or start from one of these.
        </Text>
      </View>
      <View className="gap-2">
        {deck.map((meal) => (
          <Pressable
            key={meal.title}
            onPress={() => pick(meal)}
            className="gap-1 rounded-2xl bg-secondary px-4 py-3 active:bg-accent"
          >
            <Text className="text-base font-semibold leading-snug">{meal.title}</Text>
            <Text className="text-sm leading-5 text-foreground/80">{meal.vibe}</Text>
            <Text variant="muted" numberOfLines={1}>
              {meal.ingredients}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
