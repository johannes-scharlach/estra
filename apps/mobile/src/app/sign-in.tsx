import { Redirect } from "expo-router";

import { SignIn } from "@/components/sign-in";
import { useAuth } from "@/db/provider";

export default function SignInRoute() {
  const { session, ready } = useAuth();

  if (ready && session) {
    return <Redirect href="/meals" />;
  }

  return <SignIn />;
}
