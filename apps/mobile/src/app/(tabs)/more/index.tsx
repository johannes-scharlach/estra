import { Host, ListItem } from "@expo/ui";
import { useStatus } from "@powersync/react";
import { useRouter } from "expo-router";
import { useResolveClassNames } from "uniwind";

import { useAuth } from "@/db/provider";
import { MoreList } from "@/features/more/more-list";
import { supabase } from "@/lib/supabase";

export default function More() {
  const router = useRouter();
  const { session } = useAuth();
  const status = useStatus();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const primaryColor = useResolveClassNames("bg-primary").backgroundColor;
  const lastSynced = status.hasSynced
    ? (status.lastSyncedAt?.toLocaleTimeString() ?? "Just now")
    : "Never";

  return (
    <Host
      style={{ flex: 1, backgroundColor }}
      seedColor={primaryColor}
      useViewportSizeMeasurement
    >
      <MoreList>
        <ListItem onPress={() => router.push("/profile" as never)}>
          Household Profile
        </ListItem>
        <ListItem supportingText={session?.user.email}>Email</ListItem>
        <ListItem supportingText={lastSynced}>Last synced</ListItem>
        <ListItem onPress={() => void supabase.auth.signOut()}>
          Sign out
        </ListItem>
      </MoreList>
    </Host>
  );
}
