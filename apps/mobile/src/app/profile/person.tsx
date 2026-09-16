import { newPerson, type HouseholdPerson } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { removePerson, savePerson } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, FormScreen, PersonFields } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

export default function ProfilePerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  const person = household.people.find((p) => p.id === id);
  if (id && !person)
    return (
      <FormScreen>
        <Text>This person is no longer in the household.</Text>
      </FormScreen>
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
    <FormScreen>
      <FormError message={error} />
      <PersonFields person={person} onChange={setPerson} />
      <Button disabled={busy} onPress={() => void commit()}>
        <Text>{busy ? "Saving…" : "Save person"}</Text>
      </Button>
      <Button variant="ghost" disabled={busy} onPress={() => router.back()}>
        <Text>Cancel</Text>
      </Button>
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
    </FormScreen>
  );
}
