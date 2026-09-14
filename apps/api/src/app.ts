import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { requireUser, type AppBindings } from "./auth.js";
import { chats } from "./routes/chats.js";
import { items } from "./routes/items.js";
import { AppError } from "./errors.js";
import { recipes } from "./routes/recipes.js";

export const app = new Hono<AppBindings>();

app.use("*", logger());

// The native app is not subject to CORS; Expo web and browser testing are.
app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

// Unauthenticated on purpose: Fly's health check has no token to present.
app.get("/health", (c) => c.json({ ok: true }));

// Everything under /v1 needs a Supabase access token. Mounted after cors so
// preflight requests, which carry no Authorization header, are not rejected.
app.use("/v1/*", requireUser);
app.route("/v1/chats", chats);
app.route("/v1/items", items);
app.route("/v1/recipes", recipes);

app.notFound((c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status,
    );
  }
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: err.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
          message: err.message,
        },
      },
      err.status,
    );
  }

  console.error(err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    500,
  );
});
