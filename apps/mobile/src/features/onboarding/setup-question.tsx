import {
  dietOptions,
  type CookingProfile,
  type HouseholdPerson,
} from "@magpie/profile";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";
import { AddRow } from "@/components/add-row";
import { Text } from "@/components/ui/text";
import { type Step } from "@/features/onboarding/draft";
import { PersonRow } from "@/features/onboarding/person-row";
import { useOnboarding } from "@/features/onboarding/provider";
import { DietEditor, Field, MealRoutineEditor } from "@/features/profile/form";
import { ChoiceTiles } from "@/features/profile/choice-tiles";
import { AvoidancesEditor } from "@/features/profile/avoidances-editor";
import { ShopsEditor } from "@/features/profile/shops-editor";

export const titles: Record<Step, string> = {
  name: "What’s your name?",
  goals: "What would you like help with?",
  diet: "How do you eat?",
  household: "Who do you cook for?",
  restrictions: "Anything to avoid?",
  groceries: "Where do you shop?",
  kitchen: "What equipment do you have?",
  pantry: "What do you nearly always have?",
  fresh: "What do you buy regularly?",
  email: "Save your kitchen",
  code: "Check your inbox",
};

export const subtitles: Record<Exclude<Step, "email" | "code">, string> = {
  name: "First name or nickname is fine.",
  goals: "Choose what matters to you.",
  diet: "Start with yourself. You can set a different diet for each person.",
  household: "Add the people you regularly cook for.",
  restrictions: "For anyone you cook for.",
  groceries: "Your usual shop, and anywhere else you go for food.",
  kitchen: "Tap the appliances you have.",
  pantry: "Cupboard staples. Tap a few — you can add more later.",
  fresh: "Fresh food you buy often, even if it’s not in the fridge today.",
};

function HouseholdEditor({
  people,
  currentPersonId,
  onAdd,
  onEdit,
  onRemove,
}: {
  people: HouseholdPerson[];
  currentPersonId: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {people.map((person, index) => {
        const isCurrentPerson = person.id === currentPersonId;
        const diet =
          person.diet === "other"
            ? person.diet_other
            : dietOptions[person.diet];
        const detail = `${person.age_group} · ${diet} · ${person.portion_reference} portion${person.portion_reference === 1 ? "" : "s"} · ${person.meal_times}`;
        return (
          <View
            key={person.id}
            className={index ? "border-t border-border" : undefined}
          >
            {isCurrentPerson ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit your details"
                onPress={() => onEdit(person.id)}
                className="min-h-16 gap-1 px-4 py-3 active:bg-accent"
              >
                <Text className="text-[17px] font-medium">
                  {person.name || "You"} (You)
                </Text>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {detail}
                </Text>
                <Text className="text-sm text-primary">Edit your details</Text>
              </Pressable>
            ) : (
              <PersonRow
                name={person.name}
                detail={detail}
                onEdit={() => onEdit(person.id)}
                onRemove={() => onRemove(person.id)}
              />
            )}
          </View>
        );
      })}
      <AddRow label="Add a person" onPress={onAdd} />
    </View>
  );
}

export function SetupQuestion({
  step,
  onNext,
  validationAttempt,
}: {
  step: Step;
  onNext: () => void;
  /** Continue was tapped with a required answer missing. */
  validationAttempt: number;
}) {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const nameRef = useRef<TextInput>(null);
  const showErrors = validationAttempt > 0;
  // Mounted on the step it opens at, so resuming elsewhere stays quiet.
  const [openedHere] = useState(() => draft?.step === step);
  useEffect(() => {
    if (showErrors && step === "name") nameRef.current?.focus();
  }, [showErrors, step, validationAttempt]);
  if (!draft) return null;
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
  return (
    <>
      {step === "name" ? (
        <Field
          ref={nameRef}
          label="What should Magpie call you?"
          hideLabel
          placeholder="Your first name or nickname"
          value={person.name}
          onChangeText={(name) => editPerson({ ...person, name })}
          error={
            showErrors && !person.name.trim()
              ? "Add a name so Magpie knows what to call you."
              : null
          }
          autoFocus={openedHere}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={onNext}
        />
      ) : null}
      {step === "goals" ? (
        <ChoiceTiles
          field="goals"
          value={draft.profile.goals}
          onChange={(goals) => editProfile({ goals })}
        />
      ) : null}
      {step === "diet" ? (
        <DietEditor
          person={person}
          onChange={editPerson}
          allowOtherDiet
          validationAttempt={validationAttempt}
          otherError={
            showErrors && person.diet === "other" && !person.diet_other.trim()
              ? "Describe your diet in a few words."
              : null
          }
        />
      ) : null}
      {step === "household" ? (
        <View className="gap-6">
          <HouseholdEditor
            currentPersonId={person.id}
            people={draft.people}
            onAdd={() => router.push("/setup/person" as never)}
            onEdit={(id) =>
              router.push({
                pathname: "/setup/person",
                params: { id },
              } as never)
            }
            onRemove={(id) =>
              void update((d) => ({
                ...d,
                people: d.people.filter((entry) => entry.id !== id),
              })).catch(() => {})
            }
          />
          <MealRoutineEditor
            value={draft.profile.meals_at_home}
            onChange={(meals_at_home) => editProfile({ meals_at_home })}
          />
        </View>
      ) : null}
      {step === "restrictions" ? (
        <AvoidancesEditor
          value={draft.profile.ingredient_avoidances}
          onChange={(ingredient_avoidances) =>
            editProfile({ ingredient_avoidances })
          }
          notes={draft.profile.restrictions}
          onNotes={(restrictions) => editProfile({ restrictions })}
        />
      ) : null}
      {step === "groceries" ? (
        <ShopsEditor profile={draft.profile} onChange={editProfile} />
      ) : null}
      {step === "kitchen" ? (
        <ChoiceTiles
          field="kitchen_equipment"
          value={draft.profile.kitchen_equipment}
          onChange={(kitchen_equipment) => editProfile({ kitchen_equipment })}
        />
      ) : null}
      {step === "pantry" ? (
        <ChoiceTiles
          field="pantry"
          value={draft.profile.pantry}
          onChange={(pantry) => editProfile({ pantry })}
        />
      ) : null}
      {step === "fresh" ? (
        <ChoiceTiles
          field="fresh_ingredients"
          value={draft.profile.fresh_ingredients}
          onChange={(fresh_ingredients) => editProfile({ fresh_ingredients })}
        />
      ) : null}
    </>
  );
}
