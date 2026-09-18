import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { z } from "zod";
import { Text } from "@/components/ui/text";
import { Field, FormError } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";

type EmailAuthOptions = {
  signup: boolean;
  email: string;
  onEmail: (email: string) => void;
  initialCode?: boolean;
  onSent: () => Promise<void>;
  onVerified: () => void;
  onEdit: () => void;
};

export type EmailAuthState = {
  codeMode: boolean;
  code: string;
  email: string;
  busy: boolean;
  error: string | null;
  primaryAction: {
    label: string;
    disabled: boolean;
    onPress: () => void;
  };
  resendAction: {
    label: string;
    disabled: boolean;
    onPress: () => void;
  } | null;
  changeCode: (text: string) => void;
  changeEmail: () => void;
  onEmail: (email: string) => void;
};

export function useEmailAuth({
  signup,
  email,
  onEmail,
  initialCode = false,
  onSent,
  onVerified,
  onEdit,
}: EmailAuthOptions): EmailAuthState {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(() =>
    initialCode ? Date.now() + 60_000 : null,
  );
  const [now, setNow] = useState(() => Date.now());
  const remaining = resendAt
    ? Math.max(0, Math.ceil((resendAt - now) / 1000))
    : 0;
  const autoAttempt = useRef("");
  const wasCodeMode = useRef(initialCode);

  useEffect(() => {
    if (initialCode && !wasCodeMode.current) setResendAt(Date.now() + 60_000);
    wasCodeMode.current = initialCode;
  }, [initialCode]);
  useEffect(() => {
    if (!resendAt || remaining <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, remaining]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const send = useCallback(async () => {
    if (inFlight.current) return;
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: { shouldCreateUser: signup },
      });
      if (result.error) throw result.error;
      setCode("");
      autoAttempt.current = "";
      setResendAt(Date.now() + 60_000);
      await onSent();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not send a code. Try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [email, onSent, signup]);

  const verify = useCallback(
    async (value: string) => {
      if (inFlight.current || value.length !== 6) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: value,
          type: "email",
        });
        if (result.error) throw result.error;
        onVerified();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "That code could not be verified. Try again.",
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [email, onVerified],
  );

  const changeCode = useCallback(
    (text: string) => {
      const next = text.replace(/\D/g, "").slice(0, 6);
      setCode(next);
      if (next.length < 6) autoAttempt.current = "";
      if (next.length === 6 && autoAttempt.current !== next) {
        autoAttempt.current = next;
        void verify(next);
      }
    },
    [verify],
  );

  const changeEmail = useCallback(() => {
    setCode("");
    autoAttempt.current = "";
    onEdit();
  }, [onEdit]);

  return {
    codeMode: initialCode,
    code,
    email,
    busy,
    error,
    primaryAction: initialCode
      ? {
          label: busy ? "Verifying…" : "Verify email",
          disabled: busy || code.length !== 6,
          onPress: () => void verify(code),
        }
      : {
          label: busy ? "Sending…" : "Send code",
          disabled: busy,
          onPress: () => void send(),
        },
    resendAction: initialCode
      ? {
          label: remaining ? `Resend in ${remaining}s` : "Resend code",
          disabled: busy || remaining > 0,
          onPress: () => void send(),
        }
      : null,
    changeCode,
    changeEmail,
    onEmail,
  };
}

export function EmailAuthFields({
  signup,
  state,
}: {
  signup: boolean;
  state: EmailAuthState;
}) {
  return (
    <View className="gap-4">
      <FormError message={state.error} />
      {state.codeMode ? (
        <>
          <Field
            label="Verification code"
            value={state.code}
            onChangeText={state.changeCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!state.busy}
            onSubmitEditing={state.primaryAction.onPress}
          />
          {state.resendAction ? (
            <Pressable
              accessibilityRole="button"
              disabled={state.resendAction.disabled}
              onPress={state.resendAction.onPress}
            >
              <Text
                className={
                  state.resendAction.disabled
                    ? "font-medium text-primary opacity-40"
                    : "font-medium text-primary"
                }
              >
                {state.resendAction.label}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={state.busy}
            onPress={state.changeEmail}
          >
            <Text
              className={
                state.busy
                  ? "font-medium text-primary opacity-40"
                  : "font-medium text-primary"
              }
            >
              Use a different email
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Field
            label="Email address"
            value={state.email}
            onChangeText={state.onEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!state.busy}
            returnKeyType="send"
            onSubmitEditing={state.primaryAction.onPress}
          />
          {!signup ? (
            <Text className="text-muted-foreground">
              New here? Go back and choose Get started.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
