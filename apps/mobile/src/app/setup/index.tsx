import { householdSchema } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { useNavigation, useRouter } from "expo-router";
import type { NavigationProp } from "expo-router/react-navigation";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { CompleteSetup } from "@/features/onboarding/complete";
import { createDraft, steps, type Step } from "@/features/onboarding/draft";
import { useOnboarding } from "@/features/onboarding/provider";
import { FormError, FormScreen } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";

export default function Welcome() {
  const router = useRouter();
  const navigation =
    useNavigation<
      NavigationProp<{ index: undefined; "[step]": { step: Step } }>
    >();
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
      const saved = await update((d) =>
        mismatch ? createDraft(Crypto.randomUUID(), Crypto.randomUUID()) : d,
      );
      const resumeStep =
        session && ["email", "code"].includes(saved.step)
          ? "fresh"
          : saved.step;
      if (resumeStep === "name") router.push("/setup/name" as never);
      else {
        // Restore navigation history as well as answers: native Back/swipe
        // must reach earlier questions after a process restart.
        const previousSteps = steps.slice(0, steps.indexOf(resumeStep) + 1);
        navigation.reset({
          index: previousSteps.length,
          routes: [
            { name: "index" },
            ...previousSteps.map((step) => ({
              name: "[step]" as const,
              params: { step },
            })),
          ],
        });
      }
    } catch {
      /* storage error is shown below */
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormScreen>
      <View className="gap-4 pt-16 pb-8">
        <Text className="text-4xl font-bold">Estra</Text>
        <Text className="text-2xl font-semibold">
          Cooking that fits your household.
        </Text>
        <Text className="text-muted-foreground">
          Tell us about your people, your kitchen, and the food you enjoy. We’ll
          take it from there.
        </Text>
      </View>
      <FormError message={error ?? access.error} />
      {!ready || !authReady ? (
        <>
          <Text>Opening your setup…</Text>
          {(error || access.error) && (
            <Button
              onPress={() => {
                if (error) retry();
                if (access.error) access.retry();
              }}
            >
              <Text>Try again</Text>
            </Button>
          )}
        </>
      ) : session && (!access.ready || access.error) ? (
        <>
          <Text>Loading your household…</Text>
          <Button onPress={access.retry}>
            <Text>Retry</Text>
          </Button>
        </>
      ) : canFinish ? (
        <CompleteSetup />
      ) : (
        <>
          {mismatch && (
            <Text>
              This saved setup belongs to another account or household. Sign in
              to resume it, or start a new setup.
            </Text>
          )}
          <Button
            className="min-h-14"
            disabled={busy}
            onPress={() => void start()}
          >
            <Text>
              {busy
                ? "Opening…"
                : session
                  ? "Set up your household"
                  : "Get started"}
            </Text>
          </Button>
          {draft && !mismatch && (
            <Text className="text-muted-foreground">
              Your saved answers are ready to continue.
            </Text>
          )}
          {!session && (
            <Button
              variant="ghost"
              onPress={() => router.push("/setup/sign-in" as never)}
            >
              <Text>Sign in</Text>
            </Button>
          )}
        </>
      )}
      {session && (
        <Button variant="ghost" onPress={() => void supabase.auth.signOut()}>
          <Text>Sign out</Text>
        </Button>
      )}
    </FormScreen>
  );
}
