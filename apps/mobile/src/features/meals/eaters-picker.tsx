import { Slider } from "@expo/ui/community/slider";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

import { formatExtraPortions, parseExtraPortions, type Eater } from "./eaters";

const SLIDER_MAX = 8;
const ON_ICON = { ios: "checkmark.circle.fill", android: "check_circle" } as const;
const OFF_ICON = { ios: "circle", android: "radio_button_unchecked" } as const;

type Props = {
  people: Eater[];
  eaterIds: string[];
  extraPortions: number;
  onEaterIdsChange: (ids: string[]) => void;
  /** null while the typed extra is not a valid number. */
  onExtraPortionsChange: (value: number | null) => void;
  /** react-native-screens #3634: native controls get a bad frame while a
   *  fit-to-content sheet presents. The parent flips this after the transition. */
  sliderReady: boolean;
};

/** Who from the household is eating, plus extra portions. Shared by the plan
 *  sheet and the per-meal editor so both say the same thing (ADR 12). */
export function EatersPicker({
  people,
  eaterIds,
  extraPortions,
  onEaterIdsChange,
  onExtraPortionsChange,
  sliderReady,
}: Props) {
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [input, setInput] = useState(formatExtraPortions(extraPortions));

  function toggle(id: string) {
    onEaterIdsChange(
      eaterIds.includes(id) ? eaterIds.filter((x) => x !== id) : [...eaterIds, id],
    );
  }

  function setFromSlider(next: number) {
    const rounded = Number(next.toFixed(2));
    setInput(formatExtraPortions(rounded));
    onExtraPortionsChange(rounded);
  }

  return (
    <>
      <View className="mt-6 gap-1 px-6">
        <Text variant="muted" className="text-xs uppercase tracking-widest">
          Who&apos;s eating
        </Text>
        {people.length ? (
          people.map((p) => {
            const on = eaterIds.includes(p.id);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(p.id)}
                className="flex-row items-center justify-between py-2.5"
              >
                <Text className={on ? "text-base" : "text-base text-muted-foreground"}>
                  {p.self ? "Me" : p.name}
                </Text>
                <SymbolView name={on ? ON_ICON : OFF_ICON} tintColor={on ? primary : muted} size={22} />
              </Pressable>
            );
          })
        ) : (
          <Text variant="muted" className="py-2.5">
            Nobody in the household yet.
          </Text>
        )}
      </View>

      <View className="mt-6 gap-3 px-6">
        <View className="flex-row items-center justify-between">
          <Text variant="muted" className="text-xs uppercase tracking-widest">
            Extra portions
          </Text>
          <Input
            value={input}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Extra portions"
            className="h-10 w-20 text-center text-base font-semibold tabular-nums"
            onChangeText={(text) => {
              setInput(text);
              onExtraPortionsChange(parseExtraPortions(text));
            }}
          />
        </View>
        {sliderReady ? (
          <Slider
            minimumValue={0}
            maximumValue={SLIDER_MAX}
            step={0.25}
            value={Math.min(SLIDER_MAX, Math.max(0, extraPortions))}
            onValueChange={setFromSlider}
            style={{ width: "100%", height: 32 }}
          />
        ) : (
          <Skeleton className="h-8 w-full rounded-full" />
        )}
        <View className="flex-row justify-between">
          <Text variant="muted" className="text-xs tabular-nums">
            0
          </Text>
          <Text variant="muted" className="text-xs tabular-nums">
            {SLIDER_MAX}
          </Text>
        </View>
      </View>
    </>
  );
}

export const EXTRA_PORTIONS_ERROR =
  "Enter zero or a positive number with no more than two decimal places.";
