import { useRouter } from "expo-router";
import { useState } from "react";
import {
  EmailAuthFields,
  useEmailAuth,
} from "@/features/onboarding/email-auth";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";

export default function ReturningSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(false);
  const auth = useEmailAuth({
    signup: false,
    email,
    onEmail: setEmail,
    initialCode: code,
    onSent: async () => setCode(true),
    onEdit: () => setCode(false),
    onVerified: () => router.replace("/setup" as never),
  });
  return (
    <OnboardingScreen
      action={auth.primaryAction}
      onBack={() => router.back()}
      subtitle={
        code
          ? `Enter the six-digit code sent to ${email.trim() || "your email"}.`
          : "We’ll email you a sign-in code."
      }
      title={code ? "Check your inbox" : "Welcome back."}
    >
      <EmailAuthFields signup={false} state={auth} />
    </OnboardingScreen>
  );
}
