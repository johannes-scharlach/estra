import { Pool } from "pg";

import { env } from "./env.js";

// Single pool for the process. `pg` handles reconnects; we reuse it across
// requests. DATABASE_URL is required at boot via env.ts.
export const pool = new Pool({
  connectionString: env.databaseUrl,
});
