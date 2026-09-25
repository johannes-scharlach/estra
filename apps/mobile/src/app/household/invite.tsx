import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import { householdInviteCode } from "@/features/invitations/api";
import { invitationUrl } from "@/features/invitations/links";
import { useActiveList } from "@/features/onboarding/access";
import { FormError } from "@/features/profile/form";
import { env } from "@/lib/env";

export default function InviteHousehold() {
  const router = useRouter();
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-6 pb-6 pt-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-lg font-semibold">
          Invite to {list?.name ?? "your household"}
        </Text>
        <CloseButton onPress={() => router.back()} disabled={busy} />
      </View>
      <View className="gap-2">
        <Text>Send one link to your family chat so everyone can join.</Text>
        <Text className="text-sm text-muted-foreground">
          Anyone with the link can join. Reset it any time to stop new joins.
        </Text>
      </View>
      <FormError message={error} />
      {reset
        ? (
          <Text
            className="text-sm text-muted-foreground"
            accessibilityLiveRegion="polite"
          >
            The old link no longer works. Existing members keep their access.
          </Text>
        )
        : null}
      <PrimaryAction
        label={busy ? "Preparing…" : "Share invite link"}
        disabled={busy || !list}
        onPress={() => void share()}
      />
      <Pressable
        accessibilityRole="button"
        className="min-h-11 items-center justify-center self-center px-4 disabled:opacity-50"
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
        <Text className="text-sm text-muted-foreground">Reset link</Text>
      </Pressable>
    </ScrollView>
  );
}
