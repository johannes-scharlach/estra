/**
 * Expo inlines `EXPO_PUBLIC_*` at build time, so these are literals in the
 * bundle rather than runtime lookups. Failing loudly here beats a confusing
 * "Network request failed" three screens later.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy apps/mobile/.env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  powersyncUrl: required(
    'EXPO_PUBLIC_POWERSYNC_URL',
    process.env.EXPO_PUBLIC_POWERSYNC_URL,
  ),
} as const;
