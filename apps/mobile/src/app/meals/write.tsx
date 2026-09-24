import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { setWrittenMeal } from "@/db/planned-meals";
import type { MealSlot } from "@/features/meals/slots";
import { mealLabel } from "@/features/meals/variant-meals";
import { useActiveList } from "@/features/onboarding/access";

export default function WriteMeal() {
  const {
    date,
    slot,
    name: initialName,
  } = useLocalSearchParams<{ date: string; slot: MealSlot; name?: string }>();
  const router = useRouter();
  const list = useActiveList();
  const [name, setName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!list || !date || !slot || !name.trim() || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await setWrittenMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        name,
        expectedName: initialName,
      });
      router.back();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save meal.",
      );
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <View collapsable={false}>
      <View className="gap-2 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">
            {initialName === undefined ? "Write in a meal" : "Edit meal"}
          </Text>
          <CloseButton onPress={() => router.back()} disabled={saving} />
        </View>
        <Text variant="muted">
          {mealLabel({ slot_date: date, meal: slot })}
        </Text>
      </View>
      <View className="mt-6 gap-2 px-6">
        <Input
          autoFocus
          accessibilityLabel="Meal name"
          placeholder="Bread and cheese, leftover lasagne…"
          value={name}
          onChangeText={setName}
          editable={!saving}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
        {error ? <Text className="text-destructive">{error}</Text> : null}
      </View>
      <SheetActions>
        <PrimaryAction
          label={saving ? "Saving…" : "Save meal"}
          disabled={saving || !name.trim() || !list}
          onPress={() => void save()}
        />
      </SheetActions>
    </View>
  );
}
