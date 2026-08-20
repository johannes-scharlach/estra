import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { supabase } from "@/lib/supabase";

export function SignIn() {
  const [email, setEmail] = useState("dev@estra.local");
  const [password, setPassword] = useState("estra-dev");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    console.log("starting sign in");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("finished sign in, error?", error);
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <View className="flex-1 gap-3 bg-background p-6">
      <Text variant="h3">Estra</Text>
      <Text variant="muted">Defaults match the local seed user.</Text>

      <Input
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="email"
      />
      <Input
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="password"
      />

      <Button onPress={submit} disabled={busy}>
        <Text>{busy ? "Signing in…" : "Sign in"}</Text>
      </Button>
      {error ? <Text variant="muted">{error}</Text> : null}
    </View>
  );
}
