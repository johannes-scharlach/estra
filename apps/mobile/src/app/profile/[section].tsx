import {
  selectionOptions,
  type CookingProfile,
  type SelectionField,
} from "@estra/profile";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  Field,
  FormError,
  FormScreen,
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
export default function EditProfileSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  if (!titles[section])
    return (
      <FormScreen>
        <Text>Unknown Profile section.</Text>
      </FormScreen>
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
    <FormScreen>
      <Stack.Screen options={{ title: titles[section] }} />
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
          onChange={(restrictions) =>
            setDraft((d) => ({ ...d, restrictions }))
          }
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
            label="Main supermarket or shop"
            value={draft.main_supermarket}
            onChangeText={(main_supermarket) =>
              setDraft((d) => ({ ...d, main_supermarket }))
            }
          />
          <Field
            label="Other shops and routine"
            multiline
            value={draft.other_shops}
            onChangeText={(other_shops) =>
              setDraft((d) => ({ ...d, other_shops }))
            }
          />
        </>
      )}
      <Button disabled={busy} onPress={() => void save()}>
        <Text>{busy ? "Saving…" : "Save"}</Text>
      </Button>
      <Button variant="ghost" disabled={busy} onPress={() => router.back()}>
        <Text>Cancel</Text>
      </Button>
    </FormScreen>
  );
}
