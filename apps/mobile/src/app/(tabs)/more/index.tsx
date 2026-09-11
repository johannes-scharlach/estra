import { Host, ListItem } from "@expo/ui";
import { useStatus } from "@powersync/react";
import { useResolveClassNames } from "uniwind";

import { useAuth } from "@/db/provider";
import { MoreList } from "@/features/more/more-list";
import { supabase } from "@/lib/supabase";

export default function More() {
  const { session } = useAuth();
  const status = useStatus();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const lastSynced = status.hasSynced
    ? (status.lastSyncedAt?.toLocaleTimeString() ?? "Just now")
    : "Never";

  return (
    <Host style={{ flex: 1, backgroundColor }} useViewportSizeMeasurement>
      <MoreList>
        <ListItem supportingText={session?.user.email}>Email</ListItem>
        <ListItem supportingText={lastSynced}>Last synced</ListItem>
        <ListItem onPress={() => void supabase.auth.signOut()}>
          Sign out
        </ListItem>
      </MoreList>
    </Host>
  );
}
