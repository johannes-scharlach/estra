import { Slider } from "@expo/ui/community/slider";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { updatePlannedMealServings } from "@/db/planned-meals";
import { parsePortions } from "@/features/meals/portions";
import type { MealSlot } from "@/features/meals/slots";

const SLIDER_MIN = 0.5;
const SLIDER_MAX = 8;

function formatPortions(value: number): string {
  return String(Number(value.toFixed(2)));
}

export default function PortionsSheet() {
  const { listId, date, slot, variantId, portions } = useLocalSearchParams<{
    listId: string;
    date: string;
    slot: MealSlot;
    variantId: string;
    portions: string;
  }>();
  const router = useRouter();
  const navigation =
    useNavigation<NativeStackNavigationProp<Record<string, never>>>();
  const initial = parsePortions(portions ?? "") ?? 2;
  const [input, setInput] = useState(formatPortions(initial));
  const [sliderValue, setSliderValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sliderReady, setSliderReady] = useState(false);

  // react-native-screens #3634: fit-to-content form sheets can give native
  // controls a bad frame during presentation. Mount after the transition.
  useEffect(
    () =>
      navigation.addListener("transitionEnd", (event) => {
        if (!event.data.closing) setSliderReady(true);
      }),
    [navigation],
  );

  function setFromSlider(next: number) {
    const rounded = Number(next.toFixed(2));
    setInput(formatPortions(rounded));
    setSliderValue(rounded);
    setError(null);
  }

  async function save() {
    const parsed = parsePortions(input);
    if (!parsed) {
      setError("Enter a positive number with no more than two decimal places.");
      return;
    }
    if (!listId || !date || !slot || !variantId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlannedMealServings(listId, date, slot, variantId, parsed);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (caught) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        caught instanceof Error ? caught.message : "Could not update portions.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <View className="px-6 pt-4">
        <Text className="text-lg font-semibold">Portions</Text>
      </View>

      <View className="mt-6 gap-3 px-6">
        <Input
          value={input}
          keyboardType="decimal-pad"
          selectTextOnFocus
          className="h-16 text-center text-3xl font-bold tabular-nums"
          onChangeText={(text) => {
            setInput(text);
            const parsed = parsePortions(text);
            if (parsed) setSliderValue(parsed);
            setError(null);
          }}
        />
        {sliderReady ? (
          <Slider
            minimumValue={SLIDER_MIN}
            maximumValue={SLIDER_MAX}
            step={0.25}
            value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, sliderValue))}
            onValueChange={setFromSlider}
            style={{ width: "100%", height: 32 }}
          />
        ) : (
          <Skeleton className="h-8 w-full rounded-full" />
        )}
        <View className="flex-row justify-between">
          <Text variant="muted" className="text-xs tabular-nums">
            0.5
          </Text>
          <Text variant="muted" className="text-xs tabular-nums">
            8
          </Text>
        </View>
      </View>

      {error ? (
        <Text selectable className="mt-4 px-6 text-destructive">
          {error}
        </Text>
      ) : null}

      <View className="mt-6 gap-2 px-6 pb-6">
        <Button size="lg" disabled={saving} onPress={() => void save()}>
          {saving ? <ActivityIndicator /> : <Text>Apply</Text>}
        </Button>
        <Button variant="ghost" disabled={saving} onPress={() => router.back()}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </>
  );
}
