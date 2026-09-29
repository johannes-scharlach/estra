import * as Crypto from "expo-crypto";
import { Stack, useRouter } from "expo-router";
import { Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queueMessage } from "@/features/chat/message-queue";
import { SeededDeck } from "@/features/chat/seeded-deck";

/**
 * The thirty weeknight ideas, behind one quiet link from Home: their own
 * entry point for the empty-handed night, not the front door (ADR 9).
 * Picking one starts a chat about it — the same push the entry form makes.
 * The deck speaks the Home preview's grammar: grouped sections, rows with
 * art, ingredient line, time.
 */
export default function IdeasSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function start(text: string) {
    const chatId = Crypto.randomUUID();
    queueMessage({ messageId: Crypto.randomUUID(), text, attachments: [] });
    if (Platform.OS === "ios") {
      router.dismissTo(`/chats/${chatId}` as never);
    } else {
      router.push(`/chats/${chatId}` as never);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Start from an idea" }} />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel="Close"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      ) : null}
      {/* The sheet body must be the app background, so the deck's white
          cards read as cards; expo-router's pageSheet defaults to white. */}
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <SeededDeck onPick={start} />
      </ScrollView>
    </>
  );
}
