import { useStatus } from "@powersync/react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { supabase } from "@/lib/supabase";

export default function More() {
  const { session } = useAuth();
  const status = useStatus();

  return (
    <View className="flex-1 gap-3 bg-background p-6">
      <Text variant="h3">More</Text>
      <Text variant="muted">{session?.user.email}</Text>
      <Text variant="muted">
        {status.hasSynced
          ? `Last synced ${status.lastSyncedAt?.toLocaleTimeString()}`
          : "Never synced"}
      </Text>
      <Button variant="outline" onPress={() => void supabase.auth.signOut()}>
        <Text>Sign out</Text>
      </Button>
    </View>
  );
}
