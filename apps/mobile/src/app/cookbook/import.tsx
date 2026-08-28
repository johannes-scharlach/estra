import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so the URL draft is always fresh. Same pattern as variant/plan. */
export default function ImportRecipeSheet() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    const trimmed = url.trim();
    if (!trimmed) return;
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
        recipe?: unknown;
        error?: string;
      };
      if (!res.ok)
        throw new Error(json.error ?? `Import failed (${res.status})`);
      if (!json.recipe || !json.id) throw new Error("No recipe returned");

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
        <Text className="text-lg font-semibold">Import recipe</Text>
        <Text variant="muted" className="text-sm">
          Paste a link — the recipe lands in your cookbook.
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
          disabled={importing || !url.trim()}
        >
          {importing ? <ActivityIndicator /> : <Text>Import</Text>}
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
