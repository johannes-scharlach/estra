import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  Stack,
  Redirect,
} from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import type { CookingProfile, HouseholdPerson } from "@estra/profile";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { steps, type Step } from "@/features/onboarding/draft";
import { EmailAuth } from "@/features/onboarding/email-auth";
import { SetupProgress } from "@/features/onboarding/progress";
import { useOnboarding } from "@/features/onboarding/provider";
import {
  DietEditor,
  Field,
  FormError,
  FormScreen,
  RestrictionsEditor,
  SelectionEditor,
} from "@/features/profile/form";

const titles: Record<Step, string> = {
  name: "What should we call you?",
  goals: "What brings you here?",
  diet: "How do you like to eat?",
  restrictions: "Anything to keep in mind?",
  household: "Who are you cooking for?",
  groceries: "Where do you shop?",
  kitchen: "Your kitchen",
  pantry: "Your usual pantry",
  fresh: "Your fresh staples",
  email: "Save your setup",
  code: "Check your email",
};
export default function WizardStep() {
  const { step: raw } = useLocalSearchParams<{ step: string }>();
  const step = steps.includes(raw as Step) ? (raw as Step) : "name";
  const index = steps.indexOf(step);
  const router = useRouter();
  const { session } = useAuth();
  const { draft, update, error: storageError } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void update((d) => ({ ...d, step })).catch(() => {});
    }, [step, update]),
  );
  if (!draft) return <Redirect href="/setup" />;
  const person = draft.people.find((p) => p.id === draft.onboarding_person_id)!;
  function editProfile(changes: Partial<CookingProfile>) {
    void update((d) => ({ ...d, profile: { ...d.profile, ...changes } })).catch(
      () => {},
    );
  }
  function editPerson(value: HouseholdPerson) {
    void update((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === value.id ? value : p)),
    })).catch(() => {});
  }
  async function next(changedPerson?: HouseholdPerson) {
    if (busy) return;
    const p = changedPerson ?? person;
    if (step === "name" && !p.name.trim()) {
      setError("Enter your name to continue.");
      return;
    }
    if (step === "diet" && p.diet === "other" && !p.diet_other.trim()) {
      setError("Describe your diet to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextStep = steps[index + 1] ?? "code";
      await update((d) => ({
        ...d,
        step: nextStep,
        people: changedPerson
          ? d.people.map((entry) => (entry.id === p.id ? p : entry))
          : d.people,
      }));
      if (step === "fresh" && session) router.replace("/setup" as never);
      else router.push(`/setup/${nextStep}` as never);
    } catch {
      /* storageError retains the answers */
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormScreen>
      <Stack.Screen options={{ title: titles[step] }} />
      <SetupProgress step={index + 1} />
      <FormError message={error ?? storageError} />
      {step === "name" && (
        <>
          <Text>Let’s make cooking feel a little more like you.</Text>
          <Field
            label="Your name"
            value={person.name}
            onChangeText={(name) => editPerson({ ...person, name })}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => void next()}
          />
        </>
      )}
      {step === "goals" && (
        <SelectionEditor
          field="goals"
          value={draft.profile.goals}
          onChange={(goals) => editProfile({ goals })}
        />
      )}
      {step === "diet" && (
        <DietEditor
          person={person}
          onChange={editPerson}
          allowOtherDiet
          advance={(p) => void next(p)}
        />
      )}
      {step === "restrictions" && (
        <RestrictionsEditor
          value={person.restrictions}
          onChange={(restrictions) => editPerson({ ...person, restrictions })}
          none={() => void next({ ...person, restrictions: "" })}
        />
      )}
      {step === "household" && (
        <>
          <Text>
            Add the people you regularly cook for. They don’t need an account.
          </Text>
          {draft.people.map((p) => (
            <View
              key={p.id}
              className="gap-2 rounded-xl border border-border p-4"
            >
              <Text className="font-semibold">
                {p.name}
                {p.id === person.id ? " (You)" : ""}
              </Text>
              <Text selectable className="text-muted-foreground">
                {p.age_group} · {p.diet}
                {p.restrictions ? ` · ${p.restrictions}` : ""}
              </Text>
              {p.id !== person.id && (
                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    onPress={() =>
                      router.push({
                        pathname: "/setup/person",
                        params: { id: p.id },
                      } as never)
                    }
                  >
                    <Text>Edit</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    onPress={() =>
                      void update((d) => ({
                        ...d,
                        people: d.people.filter((entry) => entry.id !== p.id),
                      })).catch(() => {})
                    }
                  >
                    <Text>Remove</Text>
                  </Button>
                </View>
              )}
            </View>
          ))}
          <Button
            variant="outline"
            onPress={() => router.push("/setup/person" as never)}
          >
            <Text>Add a person</Text>
          </Button>
          <Field
            label="Which meals do you usually cook at home?"
            multiline
            value={draft.profile.meals_at_home}
            onChangeText={(meals_at_home) => editProfile({ meals_at_home })}
            placeholder="Weekday dinners, lunches and dinners on weekends"
          />
        </>
      )}
      {step === "groceries" && (
        <>
          <Field
            label="Your main supermarket or shop"
            value={draft.profile.main_supermarket}
            onChangeText={(main_supermarket) =>
              editProfile({ main_supermarket })
            }
          />
          <Field
            label="Other shops and how they fit your routine"
            multiline
            value={draft.profile.other_shops}
            onChangeText={(other_shops) => editProfile({ other_shops })}
            placeholder="The market on Saturdays; the Asian shop takes a special trip"
          />
        </>
      )}
      {step === "kitchen" && (
        <SelectionEditor
          field="kitchen_equipment"
          value={draft.profile.kitchen_equipment}
          onChange={(kitchen_equipment) => editProfile({ kitchen_equipment })}
        />
      )}
      {step === "pantry" && (
        <>
          <Text>
            What do you tend to keep? This is about habits, not an inventory.
          </Text>
          <SelectionEditor
            field="pantry"
            value={draft.profile.pantry}
            onChange={(pantry) => editProfile({ pantry })}
          />
        </>
      )}
      {step === "fresh" && (
        <>
          <Text>
            Choose your usual fresh staples. You can remove any defaults.
          </Text>
          <SelectionEditor
            field="fresh_ingredients"
            value={draft.profile.fresh_ingredients}
            onChange={(fresh_ingredients) => editProfile({ fresh_ingredients })}
          />
        </>
      )}
      {(step === "email" || step === "code") &&
        (session ? (
          <Button onPress={() => router.replace("/setup" as never)}>
            <Text>Finish setup</Text>
          </Button>
        ) : (
          <EmailAuth
            key={step}
            signup
            email={draft.email}
            onEmail={(email) =>
              void update((d) => ({ ...d, email })).catch(() => {})
            }
            initialCode={step === "code"}
            onSent={async () => {
              await update((d) => ({ ...d, step: "code" }));
              if (step !== "code") router.push("/setup/code" as never);
            }}
            onEdit={() => router.replace("/setup/email" as never)}
            onVerified={() => router.replace("/setup" as never)}
          />
        ))}
      {index < 9 && (
        <Button
          disabled={busy}
          className="min-h-12"
          onPress={() => void next()}
        >
          <Text>
            {busy
              ? "Saving…"
              : step === "fresh" && session
                ? "Finish setup"
                : "Next"}
          </Text>
        </Button>
      )}
    </FormScreen>
  );
}
