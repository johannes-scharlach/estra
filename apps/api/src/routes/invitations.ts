import { Hono } from "hono";
import { html } from "hono/html";

// Public installation handoff only. Household data and acceptance stay in
// Supabase; chat previews and crawlers must never consume an invitation.
export const invitations = new Hono();

invitations.get("/:code", (c) => {
  const code = c.req.param("code");
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (!/^[0-9a-f]{32}$/.test(code)) {
    return c.text("This invitation is not valid. Ask for a new link.", 404);
  }
  const ios = installUrl(process.env.ESTRA_IOS_INSTALL_URL);
  const android = installUrl(process.env.ESTRA_ANDROID_INSTALL_URL);
  return c.html(html`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Join your household on Estra</title>
        <meta name="description"
          content="Share meals, shopping, recipes, and chats with your household.">
        <style>
            :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
            body { margin: 0; padding: 32px 24px; min-height: 80vh; display: grid; place-items: center; }
            main { max-width: 420px; } h1 { font-size: 32px; line-height: 1.15; }
            p { line-height: 1.6; } a { color: inherit; } .brand { font-weight: 700; }
            .open { display: block; text-align: center; padding: 16px; margin: 28px 0; border-radius: 12px;
              background: light-dark(#18181b, #fafafa); color: light-dark(#fafafa, #18181b); text-decoration: none; font-weight: 600; }
            .install { display: flex; gap: 24px; flex-wrap: wrap; }
          </style>
      </head>
      <body>
        <main>
          <p class="brand">estra</p>
          <h1>You’re invited to a household</h1>
          <p>Share meals, shopping, recipes, and chats with your family.</p>
          <a class="open" href="${`estra://join?code=${code}`}">Open Estra</a>
          <h2>Don’t have Estra yet?</h2>
          <p>Install Estra, then tap this invitation in your family chat again.</p>
          <div class="install">
            ${ios
              ? html`<a href="${ios}" rel="noreferrer">Install on iPhone</a>`
              : ""}
            ${android
              ? html`<a href="${android}" rel="noreferrer">Install on Android</a>`
              : ""}
          </div>
          ${!ios || !android
            ? html`<p>If an installation link for your phone isn’t listed, ask the person who invited you for one.</p>`
            : ""}
        </main>
      </body>
    </html>
  `);
});

function installUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
