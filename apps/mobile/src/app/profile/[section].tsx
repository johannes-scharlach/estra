import {
  selectionOptions,
  type CookingProfile,
  type SelectionField,
} from "@estra/profile";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { CloseButton } from "@/components/close-button";
import { PrimaryAction } from "@/components/action";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  Field,
  FormError,
  MealRoutineEditor,
  RestrictionsEditor,
  SelectionEditor,
} from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

const titles: Record<string, string> = {
  goals: "Goals",
  kitchen_equipment: "Equipment",
  pantry: "Usual pantry",
  fresh_ingredients: "Fresh staples",
  restrictions: "Household restrictions",
  meals_at_home: "Meals at home",
  shops: "Shopping routine",
};

function SectionSheet({
  title,
  busy = false,
  children,
}: {
  title: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    // Keep the main ScrollView directly under the native sheet content wrapper.
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 px-6 pt-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-lg font-semibold">{title}</Text>
        <CloseButton onPress={() => router.back()} disabled={busy} />
      </View>
      {children}
    </ScrollView>
  );
}

export default function EditProfileSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <SectionSheet title={titles[section] ?? "Profile"}>
        <FormError message={error} />
        <Text>Loading…</Text>
      </SectionSheet>
    );
  if (!titles[section])
    return (
      <SectionSheet title="Profile">
        <Text>Unknown Profile section.</Text>
      </SectionSheet>
    );
  return (
    <SectionEditor
      key={`${listId}:${section}`}
      initial={household.profile}
      listId={listId}
      section={section}
    />
  );
}
function SectionEditor({
  initial,
  listId,
  section,
}: {
  initial: CookingProfile;
  listId: string;
  section: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selection =
    section in selectionOptions ? (section as SelectionField) : null;
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const changes = selection
        ? { [selection]: draft[selection] }
        : section === "shops"
          ? {
              main_supermarket: draft.main_supermarket,
              other_shops: draft.other_shops,
            }
          : section === "restrictions"
            ? { restrictions: draft.restrictions }
            : { meals_at_home: draft.meals_at_home };
      await saveProfileSection(listId, changes);
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SectionSheet title={titles[section] ?? "Profile"} busy={busy}>
      <FormError message={error} />
      {selection && (
        <SelectionEditor
          field={selection}
          value={draft[selection]}
          onChange={(value) => setDraft((d) => ({ ...d, [selection]: value }))}
        />
      )}
      {section === "restrictions" && (
        <RestrictionsEditor
          value={draft.restrictions}
          onChange={(restrictions) => setDraft((d) => ({ ...d, restrictions }))}
        />
      )}
      {section === "meals_at_home" && (
        <MealRoutineEditor
          value={draft.meals_at_home}
          onChange={(meals_at_home) =>
            setDraft((d) => ({ ...d, meals_at_home }))
          }
        />
      )}
      {section === "shops" && (
        <>
          <Field
            label="Main grocery store"
            value={draft.main_supermarket}
            onChangeText={(main_supermarket) =>
              setDraft((d) => ({ ...d, main_supermarket }))
            }
            placeholder="e.g. Trader Joe’s, Tesco, Rewe, or Aldi"
          />
          <Field
            label="Other shops & how often you go"
            multiline
            value={draft.other_shops}
            onChangeText={(other_shops) =>
              setDraft((d) => ({ ...d, other_shops }))
            }
            placeholder="e.g. Asian grocery once a month, farmer’s market on Saturdays, bakery for fresh bread"
          />
        </>
      )}
      <PrimaryAction
        label={busy ? "Saving…" : "Save"}
        disabled={busy}
        onPress={() => void save()}
      />
    </SectionSheet>
  );
}
