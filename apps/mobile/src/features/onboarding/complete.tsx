import { householdSchema } from "@estra/profile";
import { useEffect, useRef, useState } from "react";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { powersync } from "@/db/system";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/features/profile/form";
import { onboardingArt } from "./art";
import { useHouseholdAccess } from "./access";
import { finalizeProfile } from "./finalize";
import { bindDraft } from "./draft";
import { OnboardingScreen } from "./onboarding-screen";
import { useOnboarding } from "./provider";

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForLocalHousehold(listId: string, userId: string) {
  const [list, member, profile, person] = await Promise.all([
    powersync.getOptional("SELECT id FROM lists WHERE id = ?", [listId]),
    powersync.getOptional(
      "SELECT id FROM list_members WHERE list_id = ? AND user_id = ?",
      [listId, userId],
    ),
    powersync.getOptional("SELECT id FROM household_profiles WHERE id = ?", [
      listId,
    ]),
    powersync.getOptional(
      "SELECT id FROM household_people WHERE list_id = ? LIMIT 1",
      [listId],
    ),
  ]);
  if (!list || !member || !profile || !person)
    throw new Error("Could not prepare your household. Try again.");
}

export function CompleteSetup() {
  const { session } = useAuth();
  const access = useHouseholdAccess();
  const { draft, update, clear, beginPreparation, endPreparation } =
    useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  useEffect(() => {
    if (
      !session ||
      !draft ||
      !access.ready ||
      access.error ||
      started.current === attempt
    )
      return;
    started.current = attempt;
    async function finish() {
      householdSchema.parse({ profile: draft!.profile, people: draft!.people });
      beginPreparation();
      // The local commit below makes the first app frame complete. Upload must
      // not gate this screen: setup also works while the device is offline.
      const minimumPresentation = wait(3000);
      const bound = await update((d) =>
        bindDraft(d, session!.user.id, access.listId),
      );
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== bound.user_id)
        throw new Error("Your account changed. Please try again.");
      await finalizeProfile(powersync, bound, session!.user.id);
      await Promise.all([
        minimumPresentation,
        waitForLocalHousehold(bound.list_id, session!.user.id),
      ]);
      await clear();
      endPreparation();
    }
    finish().catch((e: unknown) => {
      endPreparation();
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your household. Try again.",
      );
    });
  }, [
    session,
    draft,
    access.ready,
    access.error,
    access.listId,
    attempt,
    update,
    clear,
    beginPreparation,
    endPreparation,
  ]);
  return (
    <OnboardingScreen
      action={
        error
          ? {
              label: "Retry save",
              onPress: () => {
                setError(null);
                setAttempt((n) => n + 1);
              },
            }
          : undefined
      }
      art={onboardingArt.kitchen}
      subtitle={
        error
          ? "Your answers are still here."
          : "Tailoring meal ideas and recipes to your household."
      }
      title="Getting your kitchen ready"
    >
      <FormError message={error} />
      {!error ? (
        <Text className="text-muted-foreground">Just a moment…</Text>
      ) : null}
    </OnboardingScreen>
  );
}
