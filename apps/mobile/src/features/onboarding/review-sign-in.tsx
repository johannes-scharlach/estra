import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { Field, FormError } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";

export function ReviewSignIn({
  email,
  onEdit,
  onVerified,
}: {
  email: string;
  onEdit: () => void;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const changeEmail = useCallback(() => {
    if (!inFlight.current) onEdit();
  }, [onEdit]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          changeEmail();
          return true;
        },
      );
      return () => subscription.remove();
    }, [changeEmail]),
  );

  async function signIn() {
    if (inFlight.current || !password) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (result.error) throw result.error;
      setPassword("");
      onVerified();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const action = {
    label: busy ? "Signing in…" : "Sign in",
    disabled: busy || !password,
    onPress: () => void signIn(),
  };

  return (
    <OnboardingScreen
      action={action}
      onBack={changeEmail}
      subtitle={`Sign in as ${email}.`}
      title="Enter your password"
    >
      <View className="gap-4">
        <FormError message={error} />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoFocus
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          editable={!busy}
          returnKeyType="go"
          onSubmitEditing={action.onPress}
        />
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          disabled={busy}
          onPress={changeEmail}
        >
          <Text
            className={
              busy
                ? "text-sm text-muted-foreground/40"
                : "text-sm text-muted-foreground"
            }
          >
            Wrong email? Change address
          </Text>
        </Pressable>
      </View>
    </OnboardingScreen>
  );
}
