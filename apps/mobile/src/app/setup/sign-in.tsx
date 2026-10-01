import { useRouter } from "expo-router";
import { useState } from "react";
import {
  EmailAuthFields,
  useEmailAuth,
} from "@/features/onboarding/email-auth";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { ReviewSignIn } from "@/features/onboarding/review-sign-in";
import { signInMethod } from "@/features/onboarding/sign-in-method";

export default function ReturningSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState<string | null>(null);
  const auth = useEmailAuth({
    signup: false,
    email,
    onEmail: setEmail,
    initialCode: code,
    onSent: async () => setCode(true),
    onEdit: () => setCode(false),
    onVerified: () => router.replace("/setup" as never),
  });

  if (passwordEmail) {
    return (
      <ReviewSignIn
        email={passwordEmail}
        onEdit={() => setPasswordEmail(null)}
        onVerified={() => router.replace("/setup" as never)}
      />
    );
  }

  const usesPassword = !code && signInMethod(email) === "password";
  const primaryAction = usesPassword
    ? {
        label: "Continue",
        disabled: auth.busy,
        onPress: () => setPasswordEmail(email.trim().toLowerCase()),
      }
    : auth.primaryAction;

  return (
    <OnboardingScreen
      action={primaryAction}
      onBack={() => router.back()}
      subtitle={
        code
          ? `Enter the six-digit code sent to ${email.trim() || "your email"}.`
          : usesPassword
            ? "Continue to sign in with your password."
            : "We’ll email you a sign-in code."
      }
      title={code ? "Check your inbox" : "Welcome back."}
    >
      <EmailAuthFields signup={false} state={{ ...auth, primaryAction }} />
    </OnboardingScreen>
  );
}
