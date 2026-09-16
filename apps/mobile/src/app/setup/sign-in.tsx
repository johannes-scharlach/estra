import { useRouter } from "expo-router";
import { useState } from "react";
import { EmailAuth } from "@/features/onboarding/email-auth";
import { FormScreen } from "@/features/profile/form";

export default function ReturningSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(false);
  return (
    <FormScreen>
      <EmailAuth
        signup={false}
        email={email}
        onEmail={setEmail}
        initialCode={code}
        onSent={async () => setCode(true)}
        onEdit={() => setCode(false)}
        onVerified={() => router.replace("/setup" as never)}
      />
    </FormScreen>
  );
}
