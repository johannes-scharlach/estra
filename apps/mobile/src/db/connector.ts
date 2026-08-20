import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
} from '@powersync/react-native';

import { env } from '../lib/env';
import { supabase } from '../lib/supabase';

/**
 * Postgres error codes that mean "this write will never succeed" — a bad
 * value, a constraint violation, an RLS denial. Retrying them would wedge
 * the upload queue forever, so we drop the transaction and move on.
 * Anything else (network, 5xx) is left to retry.
 */
const FATAL_PG_CODES = /^(22...|23...|42501)$/;

export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * PowerSync calls this on connect and again whenever the token nears
   * expiry. Supabase refreshes the session transparently, so we just hand
   * over whatever the current access token is.
   */
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session) return null;

    return {
      endpoint: env.powersyncUrl,
      token: session.access_token,
    };
  }

  /**
   * Local writes land in SQLite immediately and queue here. PowerSync
   * replays this until it returns without throwing, so it must be safe to
   * run twice — writes go through Supabase's REST API and inherit RLS.
   */
  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = supabase.from(op.table);

        const result = await (async () => {
          switch (op.op) {
            case UpdateType.PUT:
              return table.upsert({ ...op.opData, id: op.id });
            case UpdateType.PATCH:
              // opData is undefined when a row was touched but no column
              // actually changed — nothing to send.
              if (!op.opData) return null;
              return table.update(op.opData).eq('id', op.id);
            case UpdateType.DELETE:
              return table.delete().eq('id', op.id);
            default:
              throw new Error(`Unhandled CRUD op: ${op.op}`);
          }
        })();

        if (result?.error) throw result.error;
      }

      await transaction.complete();
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;

      if (code && FATAL_PG_CODES.test(code)) {
        // Discarding means the local DB now disagrees with the server. The
        // next sync overwrites the local row, so the user sees their change
        // silently revert — worth surfacing in the UI once there is one.
        console.error('Discarding un-retryable write', code, error);
        await transaction.complete();
        return;
      }

      throw error;
    }
  }
}
