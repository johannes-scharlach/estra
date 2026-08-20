import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A client acting AS the calling user — RLS applies. This is what you want
 * for almost everything.
 */
export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';

  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
}

/**
 * Bypasses RLS entirely. Only for work that genuinely spans users — never
 * pass user input into a query built with this without checking ownership
 * yourself first.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(req: Request) {
  const supabase = userClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  return { supabase, user: data.user };
}
