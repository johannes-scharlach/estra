/**
 * Read once at startup and fail loudly. A server that boots with a missing
 * variable and only breaks on the first authenticated request is harder to
 * diagnose than one that refuses to start.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/api/.env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  // 8787, not 8080: the PowerSync container already has 8080 on this
  // machine. Fly sets PORT explicitly to match internal_port in fly.toml.
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl: required('SUPABASE_URL').replace(/\/+$/, ''),
  googleApiKey: required('GOOGLE_GENERATIVE_AI_API_KEY'),
  databaseUrl: required('DATABASE_URL'),
} as const;
