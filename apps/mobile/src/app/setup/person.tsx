import { newPerson, personSchema } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOnboarding } from "@/features/onboarding/provider";
import { FormError, FormScreen, PersonFields } from "@/features/profile/form";

export default function EditSetupPerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { draft, commit } = useOnboarding();
  const [person, setPerson] = useState(
    () =>
      draft?.people.find((p) => p.id === id) ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      await commit((d) => ({
        ...d,
        people: d.people.some((p) => p.id === person.id)
          ? d.people.map((p) => (p.id === person.id ? parsed.data : p))
          : [...d.people, parsed.data],
      }));
      router.back();
    } catch {
      setError("Could not save this person. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormScreen>
      <FormError message={error} />
      <PersonFields person={person} onChange={setPerson} />
      <Button disabled={busy} onPress={() => void save()}>
        <Text>{busy ? "Saving…" : "Save person"}</Text>
      </Button>
      <Button variant="ghost" disabled={busy} onPress={() => router.back()}>
        <Text>Cancel</Text>
      </Button>
    </FormScreen>
  );
}
