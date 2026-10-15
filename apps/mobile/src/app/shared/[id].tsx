import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { sharedRecipeToOpen } from "@/features/sharing/open";
import { clearPendingShare } from "@/features/sharing/pending";
import { posthog } from "@/lib/posthog";

/** A share link: saves the recipe if needed, then opens it in its place. */
export default function SharedRecipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listId, households } = useHouseholdAccess();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const listIds = households.map((h) => h.id).join(",");

  useEffect(() => {
    if (!id || !listId) return;
    let active = true;
    sharedRecipeToOpen(id, listId, listIds.split(","))
      .then((variantId) => {
        if (!active) return;
        posthog?.capture("shared_recipe_opened", { saved: variantId !== id });
        void clearPendingShare(id).catch(() => {});
        router.replace({ pathname: "/variant/[id]", params: { id: variantId } });
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [id, listId, listIds, attempt, router]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      {error ? (
        <>
          <Text className="text-center">{error}</Text>
          <Button
            variant="outline"
            onPress={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            <Text>Try again</Text>
          </Button>
        </>
      ) : (
        <>
          <ActivityIndicator />
          <Text variant="muted">Opening recipe…</Text>
        </>
      )}
    </View>
  );
}
