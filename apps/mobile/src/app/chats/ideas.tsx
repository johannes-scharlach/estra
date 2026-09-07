import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queueMessage } from "@/features/chat/message-queue";
import { SeededDeck } from "@/features/chat/seeded-deck";

/**
 * The thirty weeknight ideas, behind one quiet link from Home: their own
 * entry point for the empty-handed night, not the front door (ADR 9).
 * Picking one starts a chat about it — the same push the entry form makes.
 */
export default function IdeasSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function start(text: string) {
    const chatId = Crypto.randomUUID();
    queueMessage({ messageId: Crypto.randomUUID(), text, photo: null });
    if (Platform.OS === "ios") {
      router.dismissTo(`/chats/${chatId}` as never);
    } else {
      router.push(`/chats/${chatId}` as never);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
      <View className="px-5">
        <SeededDeck onPick={start} />
      </View>
    </ScrollView>
  );
}
