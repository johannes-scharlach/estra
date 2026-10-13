import { newPerson, personSchema, type HouseholdPerson } from "@magpie/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { CloseButton } from "@/components/close-button";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { useOnboarding } from "@/features/onboarding/provider";
import { FormError, PersonFields } from "@/features/profile/form";
import { PrimaryAction } from "@/components/action";

export function EditSetupPerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { draft, commit } = useOnboarding();
  const existing = draft?.people.find((person) => person.id === id);
  const [person, setPerson] = useState<HouseholdPerson>(
    () => existing ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const parsed = personSchema.safeParse(person);
    if (!parsed.success) {
      setValidationAttempt((value) => value + 1);
      const issue = parsed.error.issues[0];
      setFieldErrors(issue ? { [String(issue.path[0])]: issue.message } : {});
      return;
    }
    setBusy(true);
    try {
      await commit((draft) => ({
        ...draft,
        people: draft.people.some((entry) => entry.id === person.id)
          ? draft.people.map((entry) =>
              entry.id === person.id ? parsed.data : entry,
            )
          : [...draft.people, parsed.data],
      }));
      router.back();
    } catch {
      setError("Could not save this person. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || existing.id === draft?.onboarding_person_id) return;
    setBusy(true);
    try {
      await commit((draft) => ({
        ...draft,
        people: draft.people.filter((entry) => entry.id !== existing.id),
      }));
      router.back();
    } catch {
      setError("Could not remove this person. Try again.");
      setBusy(false);
    }
  }

  const title = existing ? "Edit a person" : "Add a person";
  const actionLabel = busy
    ? "Saving…"
    : existing
      ? "Save changes"
      : "Add person";
  const removeButton =
    existing && existing.id !== draft?.onboarding_person_id ? (
      <Button variant="ghost" disabled={busy} onPress={() => void remove()}>
        <Text className="text-destructive">Remove person</Text>
      </Button>
    ) : null;

  if (Platform.OS === "ios") {
    return (
      <ScrollView
        style={{ flex: 1 }}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="pb-10"
      >
        <View className="flex-row items-center justify-between gap-4 px-6 pt-4">
          <Text className="flex-1 text-lg font-semibold">{title}</Text>
          <CloseButton onPress={() => router.back()} disabled={busy} />
        </View>
        <View className="mt-4 gap-4 px-6">
          <FormError message={error} />
          <PersonFields
            person={person}
            onChange={setPerson}
            autoFocusName={!existing}
            errors={fieldErrors}
            validationAttempt={validationAttempt}
          />
          <PrimaryAction
            label={actionLabel}
            disabled={busy}
            onPress={() => void save()}
          />
          {removeButton}
        </View>
      </ScrollView>
    );
  }

  return (
    <OnboardingScreen
      action={{
        label: actionLabel,
        disabled: busy,
        onPress: () => void save(),
      }}
      onBack={() => router.back()}
      subtitle="So Magpie can tailor portions and recipes to your household."
      title={title}
    >
      <FormError message={error} />
      <PersonFields
        person={person}
        onChange={setPerson}
        errors={fieldErrors}
        validationAttempt={validationAttempt}
      />
      {removeButton}
    </OnboardingScreen>
  );
}
