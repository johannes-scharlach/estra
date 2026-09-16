import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
} from "@powersync/react-native";

import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

const JSON_COLUMNS: Record<string, readonly string[]> = {
  variants: ["ingredient_lines", "instructions"],
  household_profiles: [
    "goals",
    "kitchen_equipment",
    "pantry",
    "fresh_ingredients",
  ],
};

/** Decode a raw SQLite row map for upload — string -> object for Postgres jsonb. */
function decodeForUpload(
  table: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const col of JSON_COLUMNS[table] ?? []) {
    const v = out[col];
    if (typeof v === "string") {
      try {
        out[col] = JSON.parse(v);
      } catch (e) {
        const err = new Error(
          `Invalid JSON in ${col}: ${e instanceof Error ? e.message : String(e)}`,
        ) as Error & { code: string };
        err.code = "22P02";
        throw err;
      }
    }
  }
  return out;
}

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
            case UpdateType.PUT: {
              const data = op.opData
                ? decodeForUpload(
                    op.table,
                    op.opData as Record<string, unknown>,
                  )
                : op.opData;
              // These PUTs create identities. Retries must not overwrite a
              // completed setup (or require UPDATE access to membership).
              const createOnly = [
                "lists",
                "list_members",
                "household_profiles",
                "household_people",
              ].includes(op.table);
              return table.upsert(
                { ...data, id: op.id },
                { ignoreDuplicates: createOnly },
              );
            }
            case UpdateType.PATCH: {
              // opData is undefined when a row was touched but no column
              // actually changed — nothing to send.
              if (!op.opData) return null;
              const data = decodeForUpload(
                op.table,
                op.opData as Record<string, unknown>,
              );
              return table.update(data).eq("id", op.id);
            }
            case UpdateType.DELETE:
              return table.delete().eq("id", op.id);
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
        console.error("Discarding un-retryable write", code, error);
        await transaction.complete();
        return;
      }

      throw error;
    }
  }
}
