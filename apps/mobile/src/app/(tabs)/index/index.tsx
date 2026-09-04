import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import type { Chat, ChatMessage, List } from "@/db/schema";
import { Composer } from "@/features/chat/composer";
import { setCurrentChat, useCurrentChat } from "@/features/chat/current";
import { AssistantMessage, UserMessage } from "@/features/chat/message";
import { uploadPhoto, type Photo } from "@/features/chat/photo";
import { SeededDeck } from "@/features/chat/seeded-deck";
import {
  parseParts,
  streamReply,
  suggestionsOf,
  userMessage,
  type CookUIMessage,
  type Parts,
} from "@/features/chat/stream";

const NEW_ICON = { ios: "square.and.pencil", android: "edit_square", web: "edit_square" } as const;
const HISTORY_ICON = {
  ios: "clock.arrow.circlepath",
  android: "history",
  web: "history",
} as const;

// iPhone's compact navigation bar. Measured, not looked up: the header
// height hook lives in a package this workspace does not expose.
const NAV_BAR = 44;

type Shown = { id: string; role: string; parts: Parts };

/**
 * Home is the chat (ADR 9). Rows come from PowerSync; only the message just
 * sent and the reply in flight come from local state, and each is dropped
 * the moment its row has synced. A fresh chat's empty state is the seeded
 * deck.
 */
export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const iconColor = useResolveClassNames("text-foreground").color;
  const scrollRef = useRef<ScrollView>(null);
  const settled = useRef(false);

  const { data: lists } = useQuery<List>("SELECT * FROM lists ORDER BY created_at LIMIT 1");
  const list = lists[0] ?? null;

  const chosen = useCurrentChat();
  const { data: latest, isLoading: latestLoading } = useQuery<Pick<Chat, "id">>(
    list
      ? "SELECT id FROM chats WHERE list_id = ? ORDER BY updated_at DESC LIMIT 1"
      : "SELECT id FROM chats WHERE 0",
    list ? [list.id] : [],
  );
  const [fresh] = useState(() => Crypto.randomUUID());
  const chatId = chosen ?? latest[0]?.id ?? fresh;

  const { data: chats } = useQuery<Chat>("SELECT * FROM chats WHERE id = ?", [chatId]);
  const chat = chats[0] ?? null;
  const { data: rows, isLoading: rowsLoading } = useQuery<ChatMessage>(
    "SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at",
    [chatId],
  );

  const [pending, setPending] = useState<CookUIMessage | null>(null);
  const [inFlight, setInFlight] = useState<CookUIMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo((): Shown[] => {
    const out: Shown[] = rows.map((r) => ({
      id: r.id,
      role: r.role ?? "assistant",
      parts: parseParts(r.parts),
    }));
    const synced = new Set(rows.map((r) => r.id));
    if (pending && !synced.has(pending.id)) {
      out.push({ id: pending.id, role: "user", parts: pending.parts });
    }
    if (inFlight && !synced.has(inFlight.id)) {
      out.push({ id: inFlight.id, role: "assistant", parts: inFlight.parts });
    }
    return out;
  }, [rows, pending, inFlight]);

  const loading = latestLoading || rowsLoading;
  const empty = !loading && shown.length === 0;
  const last = shown[shown.length - 1];
  const suggestions = last?.role === "assistant" ? suggestionsOf(last.parts) : [];

  async function send(text: string, photo: Photo | null = null) {
    if (!list || busy) return;
    setInFlight(null);
    setError(null);
    setBusy(true);
    // A chat that was "the latest" is now this one by id, so a newer chat
    // from another phone cannot swap it out from under the conversation.
    setCurrentChat(chatId);
    try {
      const files = photo ? [await uploadPhoto(list.id, photo)] : [];
      const message = userMessage(text, Crypto.randomUUID(), files);
      setPending(message);
      for await (const reply of streamReply({ chatId, listId: list.id, message })) {
        setInFlight(reply);
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    void Haptics.selectionAsync();
    setPending(null);
    setInFlight(null);
    setError(null);
    setCurrentChat(Crypto.randomUUID());
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: chat?.title ?? "Home",
          headerRight: () => (
            <View className="flex-row items-center">
              <Pressable
                onPress={() => router.push("/chats/history" as never)}
                hitSlop={8}
                accessibilityLabel="Past chats"
                accessibilityRole="button"
                className="p-2"
              >
                <SymbolView name={HISTORY_ICON} tintColor={iconColor} size={22} />
              </Pressable>
              <Pressable
                onPress={startNew}
                hitSlop={8}
                accessibilityLabel="New chat"
                accessibilityRole="button"
                className="p-2"
              >
                <SymbolView name={NEW_ICON} tintColor={iconColor} size={22} />
              </Pressable>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + NAV_BAR : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-5 pb-4"
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // Open at the bottom of an existing chat; follow the reply as it
            // streams. Otherwise leave the reader where they are.
            if (!settled.current && shown.length) {
              settled.current = true;
              scrollRef.current?.scrollToEnd({ animated: false });
            } else if (busy) {
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {empty ? (
            <SeededDeck onPick={(text) => void send(text)} />
          ) : (
            <View className="gap-5 pt-3">
              {shown.map((m) =>
                m.role === "user" ? (
                  <UserMessage key={m.id} parts={m.parts} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    parts={m.parts}
                    streaming={busy && m.id === inFlight?.id}
                    onIdea={(idea) => void send(`Tell me more about ${idea.title}.`)}
                  />
                ),
              )}
              {busy && !inFlight ? (
                <Text variant="muted" className="text-base">
                  …
                </Text>
              ) : null}
              {error ? (
                <Text variant="small" className="text-destructive">
                  {error}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        <Composer
          placeholder={empty ? "What do you have?" : "Message"}
          busy={busy || !list}
          suggestions={suggestions}
          onSend={(text, photo) => void send(text, photo)}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
