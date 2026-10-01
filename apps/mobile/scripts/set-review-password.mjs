import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const reviewEmail = "johannes.scharlach+apple@gmail.com";

function projectUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid HTTPS Supabase project URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Use the HTTPS project URL, without credentials or a path.");
  }
  return url.origin;
}

function isPublicKey(key) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const parts = key.split(".");
    return (
      parts.length === 3 &&
      JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "anon"
    );
  } catch {
    return false;
  }
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY || process.argv.length !== 2) {
    throw new Error(
      "Run this helper in an interactive terminal, without arguments.",
    );
  }

  const cancelled = new AbortController();
  const cancel = () => cancelled.abort();
  process.on("SIGINT", cancel);

  async function ask(label, secret = false) {
    cancelled.signal.throwIfAborted();
    // Fresh editing buffers prevent deleted secrets being replayed later.
    const output = new Writable({
      write(chunk, _encoding, callback) {
        if (!secret) stdout.write(chunk);
        callback();
      },
    });
    const terminal = createInterface({
      input: stdin,
      output,
      terminal: true,
      historySize: 0,
    });
    terminal.on("SIGINT", cancel);
    terminal.on("close", cancel);
    stdout.write(label);
    try {
      return await terminal.question("", { signal: cancelled.signal });
    } finally {
      terminal.removeListener("close", cancel);
      terminal.close();
      output.destroy();
      if (secret) stdout.write("\n");
    }
  }

  let supabase;
  try {
    console.log(
      "Set the existing review account's app password. No account or household is created.",
    );
    const url = projectUrl(await ask("Supabase project URL: "));
    const key = (await ask("Publishable/anon key (hidden): ", true)).trim();
    if (!isPublicKey(key)) {
      throw new Error(
        "Use a publishable/anon key, not a secret or service-role key.",
      );
    }

    console.log(`\nProject: ${url}\nAccount: ${reviewEmail}`);
    const consent = await ask("Send a sign-in code to this account? [y/N] ");
    if (consent.trim().toLowerCase() !== "y") {
      console.log("Cancelled. No request sent.");
      return;
    }

    supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const sent = await supabase.auth.signInWithOtp({
      email: reviewEmail,
      options: { shouldCreateUser: false },
    });
    if (sent.error) {
      throw new Error(
        "Could not send a code. Check the project settings and email rate limits.",
      );
    }

    const token = (await ask("Six-digit email code (hidden): ", true)).trim();
    if (!/^\d{6}$/.test(token)) throw new Error("Enter a six-digit email code.");
    const verified = await supabase.auth.verifyOtp({
      email: reviewEmail,
      token,
      type: "email",
    });
    if (verified.error || !verified.data.session || !verified.data.user) {
      throw new Error(
        "Could not verify the code. Rerun the helper for a fresh code.",
      );
    }
    const user = verified.data.user;
    if (user.email?.trim().toLowerCase() !== reviewEmail) {
      throw new Error(
        "The authenticated account is not the review account. Nothing updated.",
      );
    }

    console.log(
      "Use a unique app password with at least 12 characters, not your Gmail password.",
    );
    const password = await ask("New app password (hidden): ", true);
    if (password.length < 12) throw new Error("Use at least 12 characters.");
    const confirmation = await ask("Confirm app password (hidden): ", true);
    if (password !== confirmation) {
      throw new Error("Passwords do not match. Nothing updated.");
    }
    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      throw new Error(
        "Password was not set. Check the project's password policy and try again.",
      );
    }
    if (updated.data.user?.id !== user.id) {
      throw new Error(
        "Could not confirm the updated account. Check Supabase before retrying.",
      );
    }
    console.log(
      "Password set. The existing account and household are unchanged. Test sign-in in the iOS app.",
    );
  } finally {
    if (supabase) {
      const result = await supabase.auth
        .signOut({ scope: "local" })
        .catch(() => ({ error: true }));
      if (result.error) {
        console.error(
          "Could not revoke the helper session. No session was saved to disk.",
        );
      }
    }
    process.removeListener("SIGINT", cancel);
  }
}

await main().catch((error) => {
  const cancelled = error instanceof Error && error.name === "AbortError";
  console.error(cancelled ? "Cancelled." : error.message);
  process.exitCode = cancelled ? 130 : 1;
});
