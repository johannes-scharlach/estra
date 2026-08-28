import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useQuery } from "@powersync/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import type { List } from "@/db/schema";
import { setPlannedMeal } from "@/db/planned-meals";
import { waitForVariant } from "@/db/variants";
import {
  dateKey,
  MONTH_SHORT,
  SLOT_LABEL,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

function dayLabel(date: string | undefined): string {
  if (!date) return "";
  if (date === dateKey(new Date())) return "today";
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAY_LONG[dt.getDay()]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}`;
}

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so the URL draft is always fresh. Same pattern as cookbook/import, plus
 *  planning the imported variant into the slot/date passed via params. */
export default function ImportForSlotSheet() {
  const { slot, date } = useLocalSearchParams<{ slot: MealSlot; date: string }>();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lists } = useQuery<List>("SELECT * FROM lists ORDER BY created_at LIMIT 1");
  const list = lists[0] ?? null;

  async function onImport() {
    const trimmed = url.trim();
    if (!trimmed || !list || !slot || !date) return;
    setImporting(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch(`${env.apiUrl}/v1/recipes/import-from-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = (await res.json()) as {
        id?: string;
        variantId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `Import failed (${res.status})`);
      if (!json.id || !json.variantId) throw new Error("No recipe returned");

      // The server inserted recipe+variant into Postgres; wait for the
      // variant to sync down before planning against it.
      if (!(await waitForVariant(json.variantId))) {
        throw new Error("Imported, but the recipe has not synced yet. Plan it from your cookbook in a moment.");
      }
      await setPlannedMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        recipeId: json.id,
        variantId: json.variantId,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  }

  return (
    <>
      {/* Sections are direct children of the screen root: react-native-screens
          #3634 — inside a formSheet, ScrollView frames get mangled unless the
          scroll view is a direct subview of the content wrapper. */}
      <View className="gap-1 px-6 pt-4">
        <Text className="text-lg font-semibold">
          Import for {slot ? SLOT_LABEL[slot] : ""}
        </Text>
        <Text variant="muted" className="text-sm">
          Paste a link — the recipe lands in your cookbook and is planned for{" "}
          {dayLabel(date)}.
        </Text>
      </View>

      <View className="mt-6 gap-2 px-6">
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="https://… recipe URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={() => void onImport()}
        />
        {error ? (
          <Text variant="small" className="text-destructive">
            {error}
          </Text>
        ) : null}
      </View>

      <View className="mt-6 gap-2 px-6 pb-8">
        <Button
          size="lg"
          onPress={() => void onImport()}
          disabled={importing || !url.trim() || !list}
        >
          {importing ? <ActivityIndicator /> : <Text>Import & plan</Text>}
        </Button>
        <Button
          variant="ghost"
          onPress={() => router.back()}
          disabled={importing}
        >
          <Text>Cancel</Text>
        </Button>
      </View>
    </>
  );
}
