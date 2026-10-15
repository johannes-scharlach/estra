import { Hono } from "hono";
import { html } from "hono/html";

import { pool } from "../db.js";
import { installUrl } from "./invitations.js";

type SharedRecipe = {
  name: string | null;
  description: string | null;
  ingredient_lines: { qty_text?: string | null; item_name: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only what the page shows: never the steps, the household or the sharer. */
async function readSharedRecipe(variantId: string): Promise<SharedRecipe | null> {
  const rows = await pool.query<SharedRecipe>(
    "SELECT name, description, ingredient_lines FROM variants WHERE id = $1",
    [variantId],
  );
  return rows.rows[0] ?? null;
}

// Installation handoff for a shared recipe (ADR 28). The variant id is the
// share code, so the page is as private as the /join page.
export function sharedRecipePage(read: (variantId: string) => Promise<SharedRecipe | null>) {
  const page = new Hono();
  page.get("/:id", async (c) => {
    const id = c.req.param("id");
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Robots-Tag", "noindex, nofollow");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    );
    const recipe = UUID.test(id) ? await read(id) : null;
    if (!recipe) return c.text("This recipe is no longer available.", 404);
    const ios = installUrl(process.env.MAGPIE_IOS_INSTALL_URL);
    const android = installUrl(process.env.MAGPIE_ANDROID_INSTALL_URL);
    const name = recipe.name ?? "A recipe";
    return c.html(html`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>${name} on Magpie</title>
          <meta name="description" content="${recipe.description ?? "A recipe shared with you on Magpie."}">
          <style>
            :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
            body { margin: 0; padding: 32px 24px; min-height: 80vh; display: grid; place-items: center; }
            main { max-width: 420px; } h1 { font-size: 32px; line-height: 1.15; }
            p, li { line-height: 1.6; } a { color: inherit; } .brand { font-weight: 700; }
            ul { padding-left: 20px; }
            .open { display: block; text-align: center; padding: 16px; margin: 28px 0; border-radius: 12px;
              background: light-dark(#18181b, #fafafa); color: light-dark(#fafafa, #18181b); text-decoration: none; font-weight: 600; }
            .install { display: flex; gap: 24px; flex-wrap: wrap; }
          </style>
        </head>
        <body>
          <main>
            <p class="brand">magpie</p>
            <h1>${name}</h1>
            ${recipe.description ? html`<p>${recipe.description}</p>` : ""}
            <a class="open" href="${`magpie://shared/${id.toLowerCase()}`}">Open in Magpie</a>
            <h2>Ingredients</h2>
            <ul>
              ${recipe.ingredient_lines.map(
                (line) => html`<li>${[line.qty_text, line.item_name].filter(Boolean).join(" ")}</li>`,
              )}
            </ul>
            <h2>Don’t have Magpie yet?</h2>
            <p>Install Magpie, then tap this link again. The recipe goes straight into your cookbook.</p>
            <div class="install">
              ${ios ? html`<a href="${ios}" rel="noreferrer">Install on iPhone</a>` : ""}
              ${android ? html`<a href="${android}" rel="noreferrer">Install on Android</a>` : ""}
            </div>
          </main>
        </body>
      </html>
    `);
  });
  return page;
}

export const sharedRecipes = sharedRecipePage(readSharedRecipe);
