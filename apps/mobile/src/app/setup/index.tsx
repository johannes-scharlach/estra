import { householdSchema } from "@estra/profile";
import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { onboardingArt } from "@/features/onboarding/art";
import { CompleteSetup } from "@/features/onboarding/complete";
import { createDraft } from "@/features/onboarding/draft";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { useOnboarding } from "@/features/onboarding/provider";
import { FormError } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";

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

  if (!ready || !authReady) {
    return (
      <OnboardingScreen title="Opening your setup…">
        <FormError message={error ?? access.error} />
        <Text className="text-muted-foreground">Just a moment.</Text>
        {error || access.error ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (error) retry();
              if (access.error) access.retry();
            }}
          >
            <Text className="font-medium text-primary">Try again</Text>
          </Pressable>
        ) : null}
      </OnboardingScreen>
    );
  }

  if (session && (!access.ready || access.error)) {
    return (
      <OnboardingScreen title="Loading your household…">
        <FormError message={access.error} />
        <Pressable accessibilityRole="button" onPress={access.retry}>
          <Text className="font-medium text-primary">Retry</Text>
        </Pressable>
      </OnboardingScreen>
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
          estra
        </Text>
        <View
          className="overflow-hidden rounded-2xl border border-border"
          style={{ borderCurve: "continuous" }}
        >
          <Image
            source={onboardingArt.welcome.source}
            accessibilityLabel={onboardingArt.welcome.accessibilityLabel}
            contentFit="cover"
            style={{
              width: "100%",
              aspectRatio: onboardingArt.welcome.aspectRatio,
            }}
          />
        </View>
        <Text
          accessibilityRole="header"
          className="text-[40px] font-bold leading-[44px] tracking-tight"
        >
          Make yourself{"\n"}at home.
        </Text>
        <Text className="text-[17px] leading-6 text-muted-foreground">
          Plan your meals. Shop one List. Cook something good.
        </Text>
        <Text className="text-sm text-muted-foreground">
          You can change your answers later.
        </Text>
      </View>
      <FormError message={error ?? access.error} />
      {mismatch ? (
        <Text className="text-muted-foreground">
          This saved setup belongs to another account or household. Sign in to
          resume it, or start a new setup.
        </Text>
      ) : null}
      {draft && !mismatch ? (
        <Text className="text-muted-foreground">
          Your saved answers are ready to continue.
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
          onPress={() => void supabase.auth.signOut()}
        >
          <Text className="font-medium text-primary">Sign out</Text>
        </Pressable>
      )}
    </OnboardingScreen>
  );
}
