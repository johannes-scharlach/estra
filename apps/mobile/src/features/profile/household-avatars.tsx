import { useQuery } from "@powersync/react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";

// More than this and a holiday house of friends would crowd the header.
const SHOWN = 3;

/** Who's in the household, as overlapping initials: you first. */
export function HouseholdAvatars({ listId }: { listId: string | null }) {
  const { session } = useAuth();
  const { data: people } = useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM household_people WHERE list_id = ?
     ORDER BY user_id IS ? DESC, created_at, id`,
    [listId, session?.user.id ?? null],
  );
  const extra = people.length - SHOWN;
  const circles = people
    .slice(0, extra > 0 ? SHOWN - 1 : SHOWN)
    .map((p) => ({ key: p.id, label: initial(p.name) }));
  if (extra > 0) circles.push({ key: "more", label: `+${extra + 1}` });
  return (
    <View className="flex-row">
      {circles.map((c, i) => (
        <View
          key={c.key}
          className="h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-accent"
          // Earlier circles sit on top, so you aren't tucked behind.
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: circles.length - i }}
        >
          <Text className="text-xs font-semibold text-accent-foreground">
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function initial(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}
