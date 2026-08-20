import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';

import { requireUser, type AppBindings } from './auth.js';
import { chat } from './routes/chat.js';

export const app = new Hono<AppBindings>();

app.use('*', logger());

// The native app is not subject to CORS; Expo web and browser testing are.
app.use(
  '/v1/*',
  cors({
    origin: '*',
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

// Unauthenticated on purpose: Fly's health check has no token to present.
app.get('/health', (c) => c.json({ ok: true }));

// Everything under /v1 needs a Supabase access token. Mounted after cors so
// preflight requests, which carry no Authorization header, are not rejected.
app.use('/v1/*', requireUser);
app.route('/v1/chat', chat);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: 'Unexpected error' }, 500);
});
