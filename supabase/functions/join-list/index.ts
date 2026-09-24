import { requireUser } from '../_shared/supabase.ts';
import { handleOptions, json } from '../_shared/cors.ts';

// All identity comes from the caller's JWT. The narrow database functions
// resolve bearer codes and perform membership + person linking atomically.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);
    const { action, invite_code, list_id, person_id, name } = body;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (action === 'share' || action === 'reset') {
      if (typeof list_id !== 'string' || !uuid.test(list_id)) {
        return json({ error: 'A household is required.' }, 400);
      }
      if (action === 'reset') {
        const { data, error } = await supabase.rpc('reset_household_invite', {
          target_list_id: list_id,
        });
        if (error) return failure(error);
        return json({ invite_code: data });
      }
      const { data, error } = await supabase.from('lists')
        .select('invite_code, household_profiles!inner(id)').eq('id', list_id).maybeSingle();
      if (error) return failure(error);
      if (!data) {
        return json({ error: 'Your household is still uploading. Try again shortly.' }, 404);
      }
      return json({ invite_code: data.invite_code });
    }
    if (typeof invite_code !== 'string' || !/^[0-9a-f]{32}$/.test(invite_code)) {
      return json({ error: 'This invitation is no longer valid. Ask for a new link.' }, 404);
    }
    if (action === 'preview') {
      const { data, error } = await supabase.rpc('preview_household_invite', { code: invite_code });
      return error ? failure(error) : json(data);
    }
    if (action !== 'join') return json({ error: 'Invalid action' }, 400);
    if (
      (person_id != null && (typeof person_id !== 'string' || !uuid.test(person_id))) ||
      (name != null && (typeof name !== 'string' || name.trim().length > 200))
    ) {
      return json({ error: 'Choose yourself or enter your name (up to 200 characters).' }, 400);
    }
    const { data, error } = await supabase.rpc('accept_household_invite', {
      code: invite_code,
      person_id: person_id ?? null,
      person_name: name ?? null,
    });
    return error ? failure(error) : json({ list_id: data });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Unexpected error' }, 500);
  }
});

function failure(error: { code: string; message: string }) {
  const status =
    ({ PT400: 400, PT404: 404, PT409: 409, '42501': 403 } as Record<string, number>)[error.code];
  if (!status) console.error('Household invitation failed', error.code);
  return json(
    { error: status ? error.message : 'Could not update the invitation. Try again.' },
    status ?? 500,
  );
}
