import { PowerSyncDatabase } from '@powersync/react-native';

import { SupabaseConnector } from './connector';
import { AppSchema } from './schema';

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'estra.db' },
});

export const connector = new SupabaseConnector();

export async function connectPowerSync() {
  await powersync.init();
  await powersync.connect(connector);
}

export async function disconnectPowerSync() {
  // Clears the local database as well — use on sign-out so the next user
  // on this device does not inherit the previous one's cached rows.
  await powersync.disconnectAndClear();
}
