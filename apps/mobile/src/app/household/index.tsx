import { Host } from "@expo/ui";
import {
  dietOptions,
  selectionLabels,
  type SelectionField,
} from "@estra/profile";
import { useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLayoutEffect } from "react";
import { Alert, Pressable } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import {
  useActiveList,
  useHouseholdAccess,
} from "@/features/onboarding/access";
import { supabase } from "@/lib/supabase";
import { FormError, FormScreen } from "@/features/profile/form";
import {
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "@/features/profile/settings-list";
import { useHousehold } from "@/features/profile/use-household";

const selectionTitles: Record<SelectionField, string> = {
  goals: "Goals",
  kitchen_equipment: "Equipment",
  pantry: "Usual pantry",
  fresh_ingredients: "Fresh staples",
};
const SWITCH_ICON = {
  ios: "arrow.left.arrow.right.circle",
  android: "swap_horiz",
} as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  const list = useActiveList();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const primaryColor = useResolveClassNames("bg-primary").backgroundColor;
  const iconColor = useResolveClassNames("text-foreground").color;
  const navigation = useNavigation();
  const name = list?.name;
  // The header belongs to the root stack's "household" screen, so the title
  // (the household this screen is about) is set on the parent.
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      title: name ?? "Household",
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/household/switch" as never)}
          hitSlop={8}
          accessibilityLabel="Switch household"
          accessibilityRole="button"
          className="p-2"
        >
          <SymbolView
            name={SWITCH_ICON}
            tintColor={typeof iconColor === "string" ? iconColor : undefined}
            size={24}
          />
        </Pressable>
      ),
    });
  }, [navigation, router, name, iconColor]);
  if (!household)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading your Profile…</Text>
      </FormScreen>
    );
  return (
    <Host
      style={{ flex: 1, backgroundColor }}
      seedColor={primaryColor}
      useViewportSizeMeasurement
    >
      <SettingsList>
        <SettingsSection title="People">
          {household.people.map((p) => (
            <SettingsRow
              key={p.id}
              onPress={() =>
                router.push({
                  pathname: "/household/person",
                  params: { id: p.id },
                } as never)
              }
              detail={[
                p.age_group,
                p.diet === "other" ? p.diet_other : dietOptions[p.diet],
                // "Always" is the default; only say it when it's not.
                p.meal_times && p.meal_times !== "Always"
                  ? `Usually here: ${p.meal_times}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              title={
                p.user_id === session?.user.id ? `${p.name} (You)` : p.name
              }
            />
          ))}
          <SettingsRow
            title="Add a person"
            onPress={() => router.push("/household/person" as never)}
          />
          <SettingsRow
            title="Invite to household"
            onPress={() => router.push("/household/invite" as never)}
          />
        </SettingsSection>
        <SettingsSection title="Cooking">
          <SettingsRow
            detail={
              household.profile.restrictions || "No restrictions supplied"
            }
            onPress={() => router.push("/household/restrictions" as never)}
            title="Household restrictions"
          />
          <SettingsRow
            detail={household.profile.meals_at_home || "Not specified"}
            onPress={() => router.push("/household/meals_at_home" as never)}
            title="Meals at home"
          />
          {(Object.keys(selectionTitles) as SelectionField[]).map((key) => (
            <SettingsRow
              key={key}
              detail={
                selectionLabels(key, household.profile[key]).join(", ") ||
                "None selected"
              }
              onPress={() => router.push(`/household/${key}` as never)}
              title={selectionTitles[key]}
            />
          ))}
        </SettingsSection>
        <SettingsSection title="Shopping">
          <SettingsRow
            detail={household.profile.main_supermarket || "Not specified"}
            onPress={() => router.push("/household/shops" as never)}
            title="Main shop"
          />
          <SettingsRow
            detail={household.profile.other_shops || "Not specified"}
            onPress={() => router.push("/household/shops" as never)}
            title="Other shops and routine"
          />
        </SettingsSection>
        <SettingsSection title="Account">
          <SettingsRow title="Email" detail={session?.user.email} />
          <SettingsRow title="Sign out" destructive onPress={confirmSignOut} />
        </SettingsSection>
      </SettingsList>
    </Host>
  );
}

function confirmSignOut() {
  Alert.alert("Sign out?", "You can sign back in with your email.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Sign out",
      style: "destructive",
      onPress: () => void supabase.auth.signOut(),
    },
  ]);
}
