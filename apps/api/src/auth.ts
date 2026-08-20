import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from './env.js';

export type AuthUser = { id: string; email: string | undefined };

/** Shape of `c.get(...)` for every route mounted behind `requireUser`. */
export type AppBindings = { Variables: { user: AuthUser } };

/**
 * Supabase signs access tokens with an ES256 key (`supabase gen signing-key`)
 * and publishes the public half here. jose caches the key set and only
 * refetches when it sees an unknown `kid`, so verification is local.
 *
 * That matters more here than in an edge function: this server holds
 * streaming connections open, and a call to /auth/v1/user per request would
 * put Supabase in the hot path of every chat message.
 */
const jwks = createRemoteJWKSet(new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`));

export const requireUser = createMiddleware<AppBindings>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) throw new HTTPException(401, { message: 'Unauthorized' });

  let user: AuthUser;
  try {
    // Audience but no issuer, matching powersync/service.yaml. The `iss`
    // claim is whatever address Supabase thinks it is on — 127.0.0.1
    // locally, while the caller reaches us through localhost or a tailnet
    // IP — so pinning it rejects perfectly good tokens. The key set is the
    // trust anchor: only this Supabase project can produce that signature.
    const { payload } = await jwtVerify(token, jwks, { audience: 'authenticated' });
    if (!payload.sub) throw new Error('token has no subject');

    user = {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    // Deliberately opaque: expired, forged and malformed tokens all look
    // the same to the caller.
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  c.set('user', user);
  await next();
});
