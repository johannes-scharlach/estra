import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

/** Claude Code's spinner, but for cooking: fun little messages that cycle
 *  until the first words of the reply arrive. */
const WAITING = [
  "Warming up the pan…",
  "Chopping up ideas…",
  "Salting to taste…",
  "Preheating the oven…",
  "Letting it simmer…",
  "Stirring the pot…",
  "Consulting the cookbook…",
  "Grating fresh inspiration…",
  "Peeking into your pantry…",
  "Plating it up…",
];

const TICK = 2400;

export function Waiting() {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [i, setI] = useState(() => Math.floor(Math.random() * WAITING.length));

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % WAITING.length), TICK);
    return () => clearInterval(t);
  }, []);

  return (
    <View className="my-2 flex-row items-center gap-2.5">
      <ActivityIndicator size="small" color={muted} />
      <Animated.View key={i} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}>
        <Text variant="muted" className="text-base">
          {WAITING[i]}
        </Text>
      </Animated.View>
    </View>
  );
}
