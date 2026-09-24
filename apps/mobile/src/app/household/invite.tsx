import { useState } from "react";
import { Alert, Share } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { householdInviteCode } from "@/features/invitations/api";
import { invitationUrl } from "@/features/invitations/links";
import { useActiveList } from "@/features/onboarding/access";
import { FormError, FormScreen } from "@/features/profile/form";
import { env } from "@/lib/env";

export default function InviteHousehold() {
  const list = useActiveList();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  async function share(resetLink = false) {
    if (!list || busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await householdInviteCode(list.id, resetLink);
      if (resetLink) setReset(true);
      await Share.share({
        message: `Join ${list.name} on Estra:\n${
          invitationUrl(env.apiUrl, code)
        }`,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not share the invitation. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormScreen>
      <Text variant="h2">Invite to {list?.name ?? "your household"}</Text>
      <Text className="text-muted-foreground">
        Send one link to your family chat. Everyone can use it to join and
        choose themselves from your household’s people.
      </Text>
      <Text className="text-muted-foreground">
        Anyone with the link can join. It stays valid until you reset it.
      </Text>
      <FormError message={error} />
      {reset
        ? (
          <Text>
            The old link no longer works. Existing members keep their access.
          </Text>
        )
        : null}
      <Button disabled={busy || !list} onPress={() => void share()}>
        <Text>{busy ? "Preparing…" : "Share invite link"}</Text>
      </Button>
      <Button
        variant="outline"
        disabled={busy || !list}
        onPress={() =>
          Alert.alert(
            "Reset invite link?",
            "The old link will stop working. People who already joined will keep their access.",
            [{ text: "Cancel", style: "cancel" }, {
              text: "Reset and share",
              onPress: () => void share(true),
            }],
          )}
      >
        <Text>Reset link</Text>
      </Button>
    </FormScreen>
  );
}
