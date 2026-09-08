import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { importRecipe } from "@/features/meals/import-adapters";

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so the URL draft is always fresh. Same pattern as variant/plan. */
export default function ImportRecipeSheet() {
  const router = useRouter();
  const operation = useRef<{ url: string; operationId: string } | null>(null);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    const trimmed = url.trim();
    if (!trimmed || importing) return;
    setImporting(true);
    setError(null);
    try {
      if (operation.current?.url !== trimmed) {
        operation.current = { url: trimmed, operationId: Crypto.randomUUID() };
      }
      await importRecipe(operation.current);

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
          autoFocus
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
