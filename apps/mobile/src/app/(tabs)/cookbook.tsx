import { useQuery } from "@powersync/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export default function Cookbook() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: recent, isLoading } = useQuery<Variant>(
    "SELECT * FROM variants ORDER BY created_at DESC LIMIT 50",
  );

  async function onImport() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setStatus(null);
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
        recipe?: unknown;
        error?: string;
      };
      if (!res.ok)
        throw new Error(json.error ?? `Import failed (${res.status})`);
      if (!json.recipe || !json.id) throw new Error("No recipe returned");

      setUrl("");
      setStatus("Imported — syncing…");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 gap-4 bg-background p-6">
      <Text variant="h3">Cookbook</Text>

      <View className="gap-2">
        <Text variant="muted">Import from URL</Text>
        <View className="flex-row items-center gap-2">
          <Input
            className="flex-1"
            value={url}
            onChangeText={setUrl}
            placeholder="https://… recipe URL"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void onImport()}
          />
          <Button onPress={() => void onImport()} disabled={loading}>
            <Text>{loading ? "…" : "Import"}</Text>
          </Button>
        </View>
        {status ? <Text variant="small">{status}</Text> : null}
      </View>

      <Text variant="small" className="font-semibold">
        Latest 50 imports
      </Text>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <ScrollView contentContainerClassName="gap-2">
          {recent.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/variant/${r.id}` as never)}
              className="rounded-lg border border-border bg-card p-3 active:bg-accent"
            >
              <Text className="font-medium">{r.name}</Text>
              {r.description ? (
                <Text variant="muted" className="text-sm">
                  {r.description}
                </Text>
              ) : null}
              <Text variant="muted" className="text-xs">
                {r.recipe_yield ?? ""} {r.total_time ? `· ${r.total_time}` : ""}
              </Text>
            </Pressable>
          ))}
          {recent.length === 0 ? (
            <Text variant="muted">No recipes yet. Paste a URL above.</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
