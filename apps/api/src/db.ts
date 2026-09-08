import { Pool, type PoolClient } from "pg";

import { env } from "./env.js";

// Single pool for the process. `pg` handles reconnects; we reuse it across
// requests. DATABASE_URL is required at boot via env.ts.
export const pool = new Pool({
  connectionString: env.databaseUrl,
});

/** The outer operation owns the transaction; persistence functions receive it. */
export async function inTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
