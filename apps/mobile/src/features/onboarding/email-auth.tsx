import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View, type TextInput } from "react-native";
import { type OTPInputRef } from "input-otp-native";
import { z } from "zod";
import { InputOTP } from "@/components/ui/input-otp";
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
  focusRequest: number;
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
  const [focusRequest, setFocusRequest] = useState(0);
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
      setFocusRequest((value) => value + 1);
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
      if (inFlight.current) return;
      if (value.length !== 6) {
        setError("Enter all six digits.");
        setFocusRequest((value) => value + 1);
        return;
      }
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
    focusRequest,
    primaryAction: initialCode
      ? {
          label: busy ? "Verifying…" : "Verify email",
          disabled: busy,
          onPress: () => void verify(code),
        }
      : {
          label: busy ? "Sending…" : "Send code",
          disabled: busy,
          onPress: () => void send(),
        },
    resendAction: initialCode
      ? {
          label: remaining
            ? `Didn’t get it? Resend in ${remaining}s`
            : "Didn’t get a code? Resend",
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
  const emailInput = useRef<TextInput>(null);
  const codeInput = useRef<OTPInputRef>(null);
  useEffect(() => {
    if (!state.focusRequest) return;
    if (state.codeMode) codeInput.current?.focus();
    else emailInput.current?.focus();
  }, [state.focusRequest, state.codeMode]);
  return (
    <View className="gap-4">
      {state.codeMode ? (
        <>
          <View className="gap-2">
            <Text className="font-medium">Verification code</Text>
            <InputOTP
              ref={codeInput}
              maxLength={6}
              autoFocus
              value={state.code}
              onChange={state.changeCode}
              accessibilityLabel="Verification code"
              invalid={!!state.error}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="number-pad"
            />
            <FormError message={state.error} />
          </View>
          {state.resendAction ? (
            <Pressable
              accessibilityRole="button"
              disabled={state.resendAction.disabled}
              onPress={state.resendAction.onPress}
            >
              <Text
                className={
                  state.resendAction.disabled
                    ? "text-sm text-muted-foreground/60"
                    : "text-sm text-muted-foreground underline"
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
                  ? "text-sm text-muted-foreground/40"
                  : "text-sm text-muted-foreground"
              }
            >
              Wrong email? Change address
            </Text>
          </Pressable>
        </>
      ) : (
        <Field
          label="Email address"
          ref={emailInput}
          value={state.email}
          onChangeText={state.onEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          error={state.error}
          editable={!state.busy}
          returnKeyType="send"
          onSubmitEditing={state.primaryAction.onPress}
        />
      )}
    </View>
  );
}
