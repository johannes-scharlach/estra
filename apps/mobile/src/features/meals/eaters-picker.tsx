import { Slider } from "@expo/ui/community/slider";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Input } from "@/components/ui/input";
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
};

/** Who from the household is eating, plus extra portions. Shared by the plan
 *  sheet and the per-meal editor so both say the same thing (ADR 12). */
export function EatersPicker({
  people,
  eaterIds,
  extraPortions,
  onEaterIdsChange,
  onExtraPortionsChange,
}: Props) {
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const track = useResolveClassNames("bg-muted").backgroundColor;
  const [input, setInput] = useState(formatExtraPortions(extraPortions));

  function toggle(id: string) {
    onEaterIdsChange(
      eaterIds.includes(id) ? eaterIds.filter((x) => x !== id) : [...eaterIds, id],
    );
  }

  function setFromSlider(next: number) {
    const rounded = Math.round(next * 4) / 4;
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
        <Slider
          minimumValue={0}
          maximumValue={SLIDER_MAX}
          // Android draws a dot per step; 32 of them is noise. Rounding in
          // setFromSlider keeps the value on quarters either way.
          step={Platform.OS === "ios" ? 0.25 : undefined}
          value={Math.min(SLIDER_MAX, Math.max(0, extraPortions))}
          onValueChange={setFromSlider}
          // Compose falls back to Material's default blue without these.
          {...(Platform.OS === "android" && {
            minimumTrackTintColor: primary,
            maximumTrackTintColor: track,
            thumbTintColor: primary,
          })}
          style={{ width: "100%", height: 32 }}
        />
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
