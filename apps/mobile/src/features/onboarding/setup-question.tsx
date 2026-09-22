import {
  dietOptions,
  type CookingProfile,
  type HouseholdPerson,
} from "@estra/profile";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AddRow } from "@/components/add-row";
import { Text } from "@/components/ui/text";
import { onboardingArt } from "@/features/onboarding/art";
import { type Step } from "@/features/onboarding/draft";
import { PersonRow } from "@/features/onboarding/person-row";
import { useOnboarding } from "@/features/onboarding/provider";
import {
  DietEditor,
  Field,
  MealRoutineEditor,
  RestrictionsEditor,
  SelectionEditor,
} from "@/features/profile/form";

export const titles: Record<Step, string> = {
  name: "What should Estra call you?",
  goals: "What matters most in your kitchen?",
  diet: "How do you eat?",
  household: "Who are you cooking for?",
  restrictions: "Anything to avoid?",
  groceries: "Where do you shop?",
  kitchen: "What equipment do you have?",
  pantry: "What’s in your pantry?",
  fresh: "What fresh ingredients belong in your rotation?",
  email: "Save your setup",
  code: "Check your inbox",
};

export const subtitles: Record<Exclude<Step, "email" | "code">, string> = {
  name: "This is how Estra will address you.",
  goals: "Estra will steer recipes and ideas toward your goals.",
  diet: "Your dietary baseline for recipes.",
  household: "Add anyone who regularly eats with you.",
  restrictions: "Allergies, intolerances, or things nobody in the house likes.",
  groceries: "So recipes only call for ingredients you can actually find.",
  kitchen: "Estra can adjust recipes to make sense in your kitchen.",
  pantry: "The things waiting in your cupboards, ready to cook with.",
  fresh: "So recipes feature the fresh staples you're excited to buy and cook.",
};

export const artByStep: Partial<
  Record<
    Step,
    { source: number; accessibilityLabel: string; aspectRatio?: number }
  >
> = {
  diet: onboardingArt.diet,
  kitchen: onboardingArt.kitchen,
  pantry: onboardingArt.pantry,
  fresh: onboardingArt.fresh,
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
        const detail = `${person.age_group} · ${diet} · Usually here: ${person.meal_times}`;
        return (
          <View
            key={person.id}
            className={index ? "border-t border-border" : undefined}
          >
            {isCurrentPerson ? (
              <View className="min-h-16 gap-1 px-4 py-3">
                <Text className="text-[17px] font-medium">
                  {person.name || "You"} (You)
                </Text>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {detail}
                </Text>
              </View>
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
}: {
  step: Step;
  onNext: () => void;
}) {
  const router = useRouter();
  const { draft, update } = useOnboarding();
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
          label="What should Estra call you?"
          hideLabel
          placeholder="Your first name or nickname"
          value={person.name}
          onChangeText={(name) => editPerson({ ...person, name })}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={onNext}
        />
      ) : null}
      {step === "goals" ? (
        <SelectionEditor
          field="goals"
          value={draft.profile.goals}
          onChange={(goals) => editProfile({ goals })}
        />
      ) : null}
      {step === "diet" ? (
        <DietEditor person={person} onChange={editPerson} allowOtherDiet />
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
        <RestrictionsEditor
          hideLabel
          value={draft.profile.restrictions}
          onChange={(restrictions) => editProfile({ restrictions })}
        />
      ) : null}
      {step === "groceries" ? (
        <View className="gap-6">
          <Field
            label="Main grocery store"
            value={draft.profile.main_supermarket}
            onChangeText={(main_supermarket) =>
              editProfile({ main_supermarket })
            }
            placeholder="e.g. Trader Joe’s, Tesco, Rewe, or Aldi"
          />
          <Field
            label="Other shops & how often you go"
            multiline
            value={draft.profile.other_shops}
            onChangeText={(other_shops) => editProfile({ other_shops })}
            placeholder="e.g. Asian grocery once a month, farmer’s market on Saturdays, bakery for fresh bread"
          />
        </View>
      ) : null}
      {step === "kitchen" ? (
        <SelectionEditor
          field="kitchen_equipment"
          value={draft.profile.kitchen_equipment}
          onChange={(kitchen_equipment) => editProfile({ kitchen_equipment })}
        />
      ) : null}
      {/* Follow-up feature: Apple Music grid redesign — replace high-level
          buckets with item-level staple chips ("Pick at least 3" low-floor/high-ceiling). */}
      {step === "pantry" ? (
        <SelectionEditor
          field="pantry"
          value={draft.profile.pantry}
          onChange={(pantry) => editProfile({ pantry })}
        />
      ) : null}
      {step === "fresh" ? (
        <SelectionEditor
          field="fresh_ingredients"
          value={draft.profile.fresh_ingredients}
          onChange={(fresh_ingredients) => editProfile({ fresh_ingredients })}
        />
      ) : null}
    </>
  );
}
