import { newPerson, personSchema, type HouseholdPerson } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { GlassView } from "expo-glass-effect";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { useOnboarding } from "@/features/onboarding/provider";
import { FormError, PersonFields } from "@/features/profile/form";

export function EditSetupPerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { draft, commit } = useOnboarding();
  const existing = draft?.people.find((person) => person.id === id);
  const [person, setPerson] = useState<HouseholdPerson>(
    () => existing ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const iconColor = useResolveClassNames("text-foreground").color;

  async function save() {
    const parsed = personSchema.safeParse(person);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Check this person's details.",
      );
      return;
    }
    setBusy(true);
    try {
      await commit((draft) => ({
        ...draft,
        people: draft.people.some((entry) => entry.id === person.id)
          ? draft.people.map((entry) => (entry.id === person.id ? parsed.data : entry))
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
    if (!existing) return;
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
  const actionLabel = busy ? "Saving…" : existing ? "Save changes" : "Add person";
  const removeButton = existing ? (
    <Button variant="ghost" disabled={busy} onPress={() => void remove()}>
      <Text className="text-destructive">Remove person</Text>
    </Button>
  ) : null;

  if (Platform.OS === "ios") {
    // formSheet: content is compact enough (no scrolling needed) to sidestep
    // the ScrollView-in-formSheet detent bug (react-native-screens #3634).
    // No opaque background either — the sheet's own glass material shows
    // through — and dismiss is a corner X, not the full-screen back button.
    return (
      <>
        <View className="flex-row items-start justify-between gap-3 px-6 pt-4">
          <Text className="flex-1 text-lg font-semibold">{title}</Text>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-card/80"
            onPress={() => router.back()}
            style={{ borderCurve: "continuous" }}
          >
            <GlassView
              isInteractive
              style={{
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />
            <SymbolView name="xmark" size={18} tintColor={iconColor} />
          </Pressable>
        </View>
        <View className="mt-4 gap-4 px-6 pb-8">
          <FormError message={error} />
          <PersonFields person={person} onChange={setPerson} />
          <Button size="lg" disabled={busy} onPress={() => void save()}>
            <Text>{actionLabel}</Text>
          </Button>
          {removeButton}
        </View>
      </>
    );
  }

  return (
    <OnboardingScreen
      action={{ label: actionLabel, disabled: busy, onPress: () => void save() }}
      onBack={() => router.back()}
      subtitle="Add the people you regularly cook for."
      title={title}
    >
      <FormError message={error} />
      <PersonFields person={person} onChange={setPerson} />
      {removeButton}
    </OnboardingScreen>
  );
}
