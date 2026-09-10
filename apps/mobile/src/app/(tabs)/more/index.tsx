import { Button, FieldGroup, Host, ListItem } from "@expo/ui";
import { useStatus } from "@powersync/react";
import { useResolveClassNames } from "uniwind";

import { useAuth } from "@/db/provider";
import { getFieldGroupModifiers } from "@/features/more/field-group-modifiers";
import { supabase } from "@/lib/supabase";

export default function More() {
  const { session } = useAuth();
  const status = useStatus();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const seedColor = useResolveClassNames("text-primary").color;
  const lastSynced = status.hasSynced
    ? (status.lastSyncedAt?.toLocaleTimeString() ?? "Just now")
    : "Never";

  return (
    <Host
      seedColor={seedColor}
      style={{ flex: 1, backgroundColor }}
      useViewportSizeMeasurement
    >
      <FieldGroup
        modifiers={getFieldGroupModifiers()}
        style={{ backgroundColor }}
      >
        <FieldGroup.Section title="Account">
          <ListItem supportingText={session?.user.email}>Email</ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Sync">
          <ListItem supportingText={lastSynced}>Last synced</ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section>
          <Button
            label="Sign out"
            variant="text"
            onPress={() => void supabase.auth.signOut()}
          />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
