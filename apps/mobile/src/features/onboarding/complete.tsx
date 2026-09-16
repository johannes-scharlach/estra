import { householdSchema } from "@estra/profile";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { powersync } from "@/db/system";
import { supabase } from "@/lib/supabase";
import { FormError } from "@/features/profile/form";
import { useHouseholdAccess } from "./access";
import { finalizeProfile } from "./finalize";
import { bindDraft } from "./draft";
import { useOnboarding } from "./provider";

export function CompleteSetup() {
  const { session } = useAuth();
  const access = useHouseholdAccess();
  const { draft, update, clear } = useOnboarding();
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
      const bound = await update((d) =>
        bindDraft(d, session!.user.id, access.listId),
      );
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== bound.user_id)
        throw new Error("Your account changed. Please try again.");
      await finalizeProfile(powersync, bound, session!.user.id);
      await clear();
    }
    finish().catch((e: unknown) =>
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your household. Try again.",
      ),
    );
  }, [
    session,
    draft,
    access.ready,
    access.error,
    access.listId,
    attempt,
    update,
    clear,
  ]);
  return (
    <>
      <Text>
        {error ? "Your answers are still here." : "Saving your household…"}
      </Text>
      <FormError message={error} />
      {error && (
        <Button
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          <Text>Retry save</Text>
        </Button>
      )}
    </>
  );
}
