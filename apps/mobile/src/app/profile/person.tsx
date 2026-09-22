import { newPerson, type HouseholdPerson } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";
import { CloseButton } from "@/components/close-button";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { removePerson, savePerson } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, PersonFields } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";
import { PrimaryAction } from "@/features/variants/primary-action";

function PersonSheet({
  busy = false,
  children,
}: {
  busy?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 px-6 pt-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-lg font-semibold">Household person</Text>
        <CloseButton onPress={() => router.back()} disabled={busy} />
      </View>
      {children}
    </ScrollView>
  );
}

export default function ProfilePerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <PersonSheet>
        <FormError message={error} />
        <Text>Loading…</Text>
      </PersonSheet>
    );
  const person = household.people.find((p) => p.id === id);
  if (id && !person)
    return (
      <PersonSheet>
        <Text>This person is no longer in the household.</Text>
      </PersonSheet>
    );
  return (
    <PersonEditor
      key={`${listId}:${id ?? "new"}`}
      initial={person}
      listId={listId}
    />
  );
}
function PersonEditor({
  initial,
  listId,
}: {
  initial?: HouseholdPerson;
  listId: string;
}) {
  const [person, setPerson] = useState(
    () => initial ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function commit(remove = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (remove) await removePerson(listId, person.id);
      else await savePerson(listId, person);
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this person. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonSheet busy={busy}>
      <FormError message={error} />
      <PersonFields person={person} onChange={setPerson} />
      <PrimaryAction
        label={busy ? "Saving…" : "Save person"}
        disabled={busy}
        onPress={() => void commit()}
      />
      {initial && (
        <Button
          variant="destructive"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Remove this person?",
              `${person.name} will no longer be included in the household's cooking setup.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => void commit(true),
                },
              ],
            )
          }
        >
          <Text>Remove person</Text>
        </Button>
      )}
    </PersonSheet>
  );
}
