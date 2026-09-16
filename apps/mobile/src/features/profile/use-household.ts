import { useQuery } from "@powersync/react";
import { useMemo } from "react";
import { decodeHousehold } from "@/db/profiles";

export function useHousehold(listId: string | null) {
  const { data: profiles } = useQuery<Record<string, unknown>>(
    "SELECT * FROM household_profiles WHERE id = ?",
    [listId],
  );
  const { data: people } = useQuery<Record<string, unknown>>(
    "SELECT * FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [listId],
  );
  return useMemo(() => {
    if (!profiles[0]) return { household: null, error: null };
    try {
      return { household: decodeHousehold(profiles[0], people), error: null };
    } catch {
      return {
        household: null,
        error:
          "Your household details are still downloading or could not be read. Try again shortly.",
      };
    }
  }, [profiles, people]);
}
