import { handleOptions, json } from '../_shared/cors.ts';
import { dispatchNotificationBatch } from '../_shared/notification-delivery.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const expected = Deno.env.get('NOTIFICATION_WORKER_SECRET');
  if (!expected || req.headers.get('x-notification-secret') !== expected) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const processed = await dispatchNotificationBatch(adminClient(), 5);
    return json({ processed });
  } catch (error) {
    console.error('Notification dispatch failed', error);
    return json({ error: 'Notification dispatch failed' }, 500);
  }
});
