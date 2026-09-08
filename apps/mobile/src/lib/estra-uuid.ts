import { v5 as uuidv5 } from "uuid";

// Persisted identity: keep this namespace and callers' input encoding stable.
// Mirrored in the other runtime's estra-uuid.ts.
export function estraUuidV5(parts: string): string {
  return uuidv5(parts, "6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77");
}
