import { serve } from '@hono/node-server';

import { app } from './app.js';
import { env } from './env.js';

const server = serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});

/**
 * Fly sends SIGTERM before it stops or suspends a machine. Closing the
 * server stops new connections but lets in-flight streams finish, instead
 * of cutting a half-written chat response off mid-sentence.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
