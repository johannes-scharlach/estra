import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { supabase } from "@/lib/supabase";

import { challengeGoals, type ChallengeCounts } from "./goals";

const DONE_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
} as const;
const OPEN_ICON = { ios: "circle", android: "radio_button_unchecked" } as const;

/** Per user, on every device: the account remembers the finish moment. */
const FINISHED_KEY = "first_run_challenge_finished_at";

/**
 * The first-run challenge on Home (spec 0011). Goals, not a tour: each line
 * says what to do and the app is where you do it. Once everything is done
 * the card says so once; Done puts it away for good.
 */
export function ChallengeCard() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const finished = Boolean(session?.user.user_metadata?.[FINISHED_KEY]);
  const counts = useChallengeCounts(userId);
  const { goals, complete } = challengeGoals(counts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;

  useEffect(() => {
    if (complete && !finished)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [complete, finished]);

  if (!userId || finished) return null;

  async function finish() {
    setSaving(true);
    setError(null);
    const { error: failed } = await supabase.auth.updateUser({
      data: { [FINISHED_KEY]: new Date().toISOString() },
    });
    setSaving(false);
    if (failed) setError("Could not save. Try again.");
  }

  return (
    <View className="mx-4 mb-8 gap-3">
      <Text className="text-xl font-semibold">
        {complete ? "Challenge complete" : "Your first-run challenge"}
      </Text>
      <View className="gap-3 rounded-2xl bg-card px-4 py-4">
        {complete ? (
          <Text className="text-muted-foreground">
            Your cookbook is yours now, and you know every way into a meal.
          </Text>
        ) : null}
        {goals.map((goal) =>
          goal.target > 1 ? (
            <View
              key={goal.key}
              className="gap-2"
              accessible
              accessibilityLabel={`${goal.label}: ${goal.count} of ${goal.target}`}
            >
              <View className="flex-row items-center gap-2.5">
                <SymbolView
                  name={goal.done ? DONE_ICON : OPEN_ICON}
                  tintColor={goal.done ? primary : muted}
                  size={22}
                />
                <Text className="flex-1">{goal.label}</Text>
                <Text className="text-muted-foreground">
                  {goal.count}/{goal.target}
                </Text>
              </View>
              <View className="ml-8 h-1.5 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(goal.count / goal.target) * 100}%` }}
                />
              </View>
            </View>
          ) : (
            <View
              key={goal.key}
              className="flex-row items-center gap-2.5"
              accessible
              accessibilityLabel={`${goal.label}: ${goal.done ? "done" : "not done yet"}`}
            >
              <SymbolView
                name={goal.done ? DONE_ICON : OPEN_ICON}
                tintColor={goal.done ? primary : muted}
                size={22}
              />
              <Text
                className={goal.done ? "flex-1 text-muted-foreground" : "flex-1"}
              >
                {goal.label}
              </Text>
            </View>
          ),
        )}
        {complete ? (
          <Button onPress={() => void finish()} disabled={saving}>
            <Text>Done</Text>
          </Button>
        ) : null}
        {error ? (
          <Text className="text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Recipes and recipe chats you created, across your households. */
function useChallengeCounts(userId: string | null): ChallengeCounts {
  const { data: origins } = useQuery<{ origin: string; n: number }>(
    "SELECT origin, count(*) AS n FROM recipes WHERE created_by = ? AND origin IS NOT NULL GROUP BY origin",
    [userId],
  );
  const { data: chats } = useQuery<{ n: number }>(
    "SELECT count(*) AS n FROM chats WHERE created_by = ? AND recipe_id IS NOT NULL",
    [userId],
  );
  const count = (origin: string) =>
    origins.find((row) => row.origin === origin)?.n ?? 0;
  return {
    import: count("import"),
    on_hand: count("on_hand"),
    dish: count("dish"),
    idea: count("idea"),
    recipeChats: chats[0]?.n ?? 0,
  };
}
