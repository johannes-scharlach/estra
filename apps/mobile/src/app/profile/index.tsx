import { FieldGroup, Host, ListItem } from "@expo/ui";
import {
  dietOptions,
  selectionLabels,
  type SelectionField,
} from "@estra/profile";
import { Stack, useRouter } from "expo-router";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, FormScreen } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

const selectionTitles: Record<SelectionField, string> = {
  goals: "Goals",
  kitchen_equipment: "Equipment",
  pantry: "Usual pantry",
  fresh_ingredients: "Fresh staples",
};
export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  if (!household)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading your Profile…</Text>
      </FormScreen>
    );
  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Button variant="ghost" onPress={() => router.back()}>
              <Text>Back</Text>
            </Button>
          ),
        }}
      />
      <Host style={{ flex: 1, backgroundColor }} useViewportSizeMeasurement>
        <FieldGroup>
          <FieldGroup.Section title="People">
            {household.people.map((p) => (
              <ListItem
                key={p.id}
                onPress={() =>
                  router.push({
                    pathname: "/profile/person",
                    params: { id: p.id },
                  } as never)
                }
                supportingText={[
                  p.age_group,
                  p.diet === "other" ? p.diet_other : dietOptions[p.diet],
                  p.restrictions || "No restrictions supplied",
                  `Usually here: ${p.meal_times || "Not specified"}`,
                ].join(" · ")}
              >
                {p.name}
                {p.user_id === session?.user.id ? " (You)" : ""}
              </ListItem>
            ))}
            <ListItem onPress={() => router.push("/profile/person" as never)}>
              Add a person
            </ListItem>
          </FieldGroup.Section>
          <FieldGroup.Section title="Cooking">
            <ListItem
              supportingText={
                household.profile.meals_at_home || "Not specified"
              }
              onPress={() => router.push("/profile/meals_at_home" as never)}
            >
              Meals at home
            </ListItem>
            {(Object.keys(selectionTitles) as SelectionField[]).map((key) => (
              <ListItem
                key={key}
                supportingText={
                  selectionLabels(key, household.profile[key]).join(", ") ||
                  "None selected"
                }
                onPress={() => router.push(`/profile/${key}` as never)}
              >
                {selectionTitles[key]}
              </ListItem>
            ))}
          </FieldGroup.Section>
          <FieldGroup.Section title="Shopping">
            <ListItem
              supportingText={
                household.profile.main_supermarket || "Not specified"
              }
              onPress={() => router.push("/profile/shops" as never)}
            >
              Main shop
            </ListItem>
            <ListItem
              supportingText={household.profile.other_shops || "Not specified"}
              onPress={() => router.push("/profile/shops" as never)}
            >
              Other shops and routine
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}
