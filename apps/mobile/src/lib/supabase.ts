import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { env } from './env';

/**
 * Session tokens live in the Keychain / Android Keystore rather than
 * AsyncStorage, which is plaintext on disk.
 *
 * SecureStore caps values at 2048 bytes. Supabase sessions carrying large
 * JWT claims can exceed that, so watch for write failures here if you start
 * putting much into app_metadata.
 */
const secureStorage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar for the OAuth/magic-link callback to
    // land in; expo-router's deep link handler feeds it to us instead.
    detectSessionInUrl: false,
  },
});
