import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Field, FormError } from "@/features/profile/form";
import { supabase } from "@/lib/supabase";

export function EmailAuth({
  signup,
  email,
  onEmail,
  initialCode = false,
  onSent,
  onVerified,
  onEdit,
}: {
  signup: boolean;
  email: string;
  onEmail: (email: string) => void;
  initialCode?: boolean;
  onSent: () => Promise<void>;
  onVerified: () => void;
  onEdit: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialCode ? 60 : 0);
  const autoAttempt = useRef("");
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  async function send() {
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
      setRemaining(60);
      await onSent();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not send a code. Try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function verify(value: string) {
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
  }
  function changeCode(text: string) {
    const next = text.replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (next.length === 6 && autoAttempt.current !== next) {
      autoAttempt.current = next;
      void verify(next);
    }
  }
  return (
    <>
      <Text>
        {initialCode
          ? `Enter the six-digit code sent to ${email}.`
          : signup
            ? "Your cooking setup is ready. Verify your email to save it to your household."
            : "Welcome back. We’ll email you a sign-in code."}
      </Text>
      <FormError message={error} />
      {initialCode ? (
        <>
          <Field
            label="Verification code"
            value={code}
            onChangeText={changeCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!busy}
          />
          <Button
            disabled={busy || code.length !== 6}
            onPress={() => void verify(code)}
          >
            <Text>{busy ? "Verifying…" : "Verify"}</Text>
          </Button>
          <Button
            variant="outline"
            disabled={busy || remaining > 0}
            onPress={() => void send()}
          >
            <Text>{remaining ? `Resend in ${remaining}s` : "Resend code"}</Text>
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setCode("");
              autoAttempt.current = "";
              onEdit();
            }}
          >
            <Text>Change email</Text>
          </Button>
        </>
      ) : (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={onEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
          />
          <Button disabled={busy} onPress={() => void send()}>
            <Text>{busy ? "Sending…" : "Send code"}</Text>
          </Button>
          {!signup && (
            <Text className="text-muted-foreground">
              New here? Go back and choose Get started.
            </Text>
          )}
        </>
      )}
    </>
  );
}
