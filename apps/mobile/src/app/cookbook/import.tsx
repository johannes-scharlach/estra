import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { View } from "react-native";

import { CloseButton } from "@/components/close-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { importRecipe } from "@/features/meals/import-adapters";
import { PrimaryAction } from "@/features/variants/primary-action";

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
    <View collapsable={false}>
      <View className="gap-1 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-lg font-semibold">Import recipe</Text>
          <CloseButton onPress={() => router.back()} disabled={importing} />
        </View>
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

      <View className="mt-6 gap-2 px-6">
        <PrimaryAction
          label={importing ? "Importing…" : "Import"}
          onPress={() => void onImport()}
          disabled={importing || !url.trim()}
        />
      </View>
    </View>
  );
}
