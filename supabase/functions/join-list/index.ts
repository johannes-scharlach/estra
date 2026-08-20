import { adminClient, requireUser } from '../_shared/supabase.ts';
import { handleOptions, json } from '../_shared/cors.ts';

/**
 * Redeem an invite code and join the list it belongs to.
 *
 * This cannot be done from the client: RLS only lets you read a list you
 * are already a member of, so the joiner cannot look up the list to insert
 * their own membership row. Resolving the code needs service-role, which
 * means it has to happen somewhere the key is not shipped to a device.
 */
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { user } = await requireUser(req);

    const { invite_code } = await req.json().catch(() => ({}));
    if (typeof invite_code !== 'string' || !invite_code.trim()) {
      return json({ error: 'invite_code is required' }, 400);
    }

    const admin = adminClient();

    const { data: list, error: listError } = await admin
      .from('lists')
      .select('id, name')
      .eq('invite_code', invite_code.trim())
      .maybeSingle();

    if (listError) return json({ error: listError.message }, 500);
    // Same response whether the code is wrong or the list is gone — a
    // distinguishable answer would let someone probe for valid codes.
    if (!list) return json({ error: 'Invalid invite code' }, 404);

    // Idempotent: re-redeeming a code you have already used is a no-op
    // rather than a unique-violation error.
    const { error: joinError } = await admin
      .from('list_members')
      .upsert({ list_id: list.id, user_id: user.id }, { onConflict: 'list_id,user_id' });

    if (joinError) return json({ error: joinError.message }, 500);

    return json({ list_id: list.id, name: list.name });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Unexpected error' }, 500);
  }
});
