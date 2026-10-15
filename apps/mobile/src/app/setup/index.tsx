import { householdSchema } from "@magpie/profile";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { Artwork } from "@/features/onboarding/artwork";
import { CompleteSetup } from "@/features/onboarding/complete";
import { createDraft } from "@/features/onboarding/draft";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { useOnboarding } from "@/features/onboarding/provider";
import { StartupScreen } from "@/features/onboarding/startup-screen";
import { FormError } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";
import { unregisterPushDevice } from "@/features/notifications/notifications";

export default function Welcome() {
  const router = useRouter();
  const { session, ready: authReady } = useAuth();
  const access = useHouseholdAccess();
  const { draft, ready, error, update, retry } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const mismatch =
    (!!draft?.user_id && draft.user_id !== session?.user.id) ||
    (!!draft?.user_id && !!access.listId && draft.list_id !== access.listId) ||
    (!!session?.user.email &&
      !!draft?.email.trim() &&
      draft.email.trim().toLowerCase() !== session.user.email.toLowerCase());
  const canFinish =
    session &&
    !mismatch &&
    draft &&
    ["email", "code"].includes(draft.step) &&
    householdSchema.safeParse({ profile: draft.profile, people: draft.people })
      .success;

  async function start() {
    setBusy(true);
    try {
      await update((draft) => {
        const next = mismatch
          ? createDraft(Crypto.randomUUID(), Crypto.randomUUID())
          : draft;
        // A session bypasses the email gate. Persist the resumed step before
        // changing routes so an interruption cannot later finalize early.
        return session && ["email", "code"].includes(next.step)
          ? { ...next, step: "fresh" }
          : next;
      });
      router.push("/setup/questions" as never);
    } catch {
      /* storage error is shown below */
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !authReady || (session && (!access.ready || access.error))) {
    return (
      <StartupScreen
        error={error ?? access.error}
        onRetry={() => {
          if (!ready) retry();
          access.retry();
        }}
      />
    );
  }

  if (canFinish) return <CompleteSetup />;

  return (
    <OnboardingScreen
      action={{
        label: busy
          ? "Opening…"
          : session
            ? "Set up your household"
            : "Get started",
        disabled: busy,
        onPress: () => void start(),
      }}
    >
      <View className="gap-5 pb-3">
        <Text className="text-[25px] font-semibold tracking-tight text-primary">
          magpie
        </Text>
        <Artwork id="welcome-market-find" hero />
        <Text
          accessibilityRole="header"
          className="text-4xl font-bold leading-11 tracking-tight"
        >
          Magpie is the meal plan that adapts to your life.
        </Text>
        <Text className="text-xl leading-6 text-muted-foreground">
          Move meals around whenever your day changes. Magpie suggests what
          suits you: from your own cookbook, or from what&apos;s on hand.
        </Text>
      </View>
      <FormError message={error ?? access.error} />
      {mismatch ? (
        <Text className="text-muted-foreground">
          This saved setup belongs to another account or household. Sign in to
          resume it, or start a new setup.
        </Text>
      ) : null}
      {!session ? (
        <Pressable
          accessibilityRole="button"
          className="self-start"
          onPress={() => router.push("/setup/sign-in" as never)}
        >
          <Text className="font-medium text-primary">Sign in</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          className="self-start"
          onPress={() => void signOut()}
        >
          <Text className="font-medium text-primary">Sign out</Text>
        </Pressable>
      )}
    </OnboardingScreen>
  );
}

async function signOut() {
  try {
    await unregisterPushDevice();
  } catch (error) {
    console.error("Could not unregister push device before sign out", error);
  }
  await supabase.auth.signOut();
}
