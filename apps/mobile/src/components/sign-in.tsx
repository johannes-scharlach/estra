import { useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior="padding"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-sm gap-8">
          <View className="gap-2">
            <Text className="text-4xl font-bold tracking-tight">Estra</Text>
            <Text variant="lead" className="text-lg">
              Plan meals. Shop together.
            </Text>
          </View>

          <View className="gap-5">
            <View className="gap-2">
              <Text variant="small">Email</Text>
              <Input
                className="h-12 rounded-xl px-4"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                textContentType="emailAddress"
              />
            </View>

            <View className="gap-2">
              <Text variant="small">Password</Text>
              <Input
                className="h-12 rounded-xl px-4"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                onSubmitEditing={() => void submit()}
                returnKeyType="go"
                secureTextEntry
                textContentType="password"
              />
            </View>

            {error ? (
              <Text className="text-sm text-destructive" selectable>
                {error}
              </Text>
            ) : null}

            <Button
              className="h-12 rounded-xl"
              onPress={() => void submit()}
              disabled={busy}
            >
              <Text>{busy ? "Signing in…" : "Sign in"}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
