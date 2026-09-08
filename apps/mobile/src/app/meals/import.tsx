import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useQuery } from "@powersync/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import type { List } from "@/db/schema";
import {
  dateKey,
  MONTH_SHORT,
  SLOT_LABEL,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";
import { useImportJobs } from "@/features/meals/use-import-jobs";

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
  const { slot, date } = useLocalSearchParams<{
    slot: MealSlot;
    date: string;
  }>();
  const router = useRouter();
  const importJobs = useImportJobs();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at LIMIT 1",
  );
  const list = lists[0] ?? null;

  function onImport() {
    const trimmed = url.trim();
    if (importing || !list || !slot || !date) return;
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      setError("Enter a valid recipe URL.");
      return;
    }
    setImporting(true);
    void importJobs.start({ listId: list.id, date, slot }, trimmed);
    router.back();
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
          autoFocus
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            setError(null);
          }}
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
