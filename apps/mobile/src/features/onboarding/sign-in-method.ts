const reviewEmail = "johannes.scharlach+apple@gmail.com";

// This selects a screen, not access: Supabase still verifies the password.
export function signInMethod(email: string): "password" | "otp" {
  return email.trim().toLowerCase() === reviewEmail ? "password" : "otp";
}
