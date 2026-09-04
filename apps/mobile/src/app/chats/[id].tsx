import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import type { Chat, ChatMessage, List } from "@/db/schema";
import { Composer } from "@/features/chat/composer";
import { AssistantMessage, UserMessage } from "@/features/chat/message";
import {
  peekQueuedMessage,
  takeQueuedMessage,
} from "@/features/chat/message-queue";
import { uploadPhoto, type Photo } from "@/features/chat/photo";
import {
  parseParts,
  streamReply,
  suggestionsOf,
  userMessage,
  type AssistantUIMessage,
  type Parts,
} from "@/features/chat/stream";
import { Waiting } from "@/features/chat/waiting";

// iPhone's compact navigation bar. Measured, not looked up: the header
// height hook lives in a package this workspace does not expose.
const NAV_BAR = 44;

type Shown = { id: string; role: string; parts: Parts };

/**
 * The conversation: pushed from the Home entry (or the history sheet), no
 * tab bar. Rows come from PowerSync; the messages in flight — and, on a
 * fresh chat, the whole chat row — are local until their synced rows
 * appear, per ADR 9. A queued message (the entry's "Get ideas", or the
 * plan sheet's confirm) is sent once on focus: on mount for a fresh chat,
 * on return from the plan sheet mid-conversation.
 */
export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ?? "";

  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at LIMIT 1",
  );
  const list = lists[0] ?? null;

  const { data: chats } = useQuery<Chat>("SELECT * FROM chats WHERE id = ?", [
    chatId,
  ]);
  const { data: rows } = useQuery<ChatMessage>(
    "SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at",
    [chatId],
  );

  // A queued message rides beside the push (the entry's "Get ideas", or
  // the plan sheet's confirm). Read once at mount for the optimistic
  // echo; the focus effect below sends it.
  const [queuedMsg] = useState(() => peekQueuedMessage());

  const [pending, setPending] = useState<AssistantUIMessage[]>(() =>
    // Local echo of the queued message minus its photo (the file part
    // comes from the async upload): the bubble shows immediately.
    queuedMsg ? [userMessage(queuedMsg.text, queuedMsg.messageId, [])] : [],
  );
  const [inFlight, setInFlight] = useState<AssistantUIMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    failed: AssistantUIMessage;
  } | null>(null);

  // Until the chat row exists this optimistic copy stands in, so the
  // header title and composer are live from the first frame.
  const chat: Chat | null =
    chats[0] ??
    (queuedMsg
      ? ({
          id: chatId,
          list_id: list?.id ?? "",
          title: queuedMsg.text.slice(0, 80) || null,
        } as Chat)
      : null);

  /**
   * One turn: local echo, stream, persist (server-side). The state
   * updates live behind an async boundary so the kick-off effect below
   * never sets state in its synchronous window.
   */
  const busyRef = useRef(false);
  async function runTurn(message: AssistantUIMessage) {
    if (!list) return;
    busyRef.current = true;
    setInFlight(null);
    setError(null);
    setBusy(true);
    try {
      setPending((p) => [...p.filter((m) => m.id !== message.id), message]);
      for await (const reply of streamReply({
        chatId,
        listId: list.id,
        message,
      })) {
        setInFlight(reply);
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // An empty in-flight reply must not linger over the error.
      setInFlight(null);
      setError({
        text: e instanceof Error ? e.message : "Something went wrong",
        failed: message,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function send(
    text: string,
    photo: Photo | null = null,
    id2 = Crypto.randomUUID(),
  ) {
    if (!list || busyRef.current) return;
    const files = photo ? [await uploadPhoto(list.id, photo)] : [];
    await runTurn(userMessage(text, id2, files));
  }

  // Send a queued message on focus — on mount for a fresh chat (the
  // queue is its first message), or on return from the plan sheet for one
  // already mid-conversation. take() makes re-runs (StrictMode double
  // effects, list identity changes) no-ops.
  useFocusEffect(
    useCallback(() => {
      if (!list) return;
      const message = takeQueuedMessage();
      if (!message) return;
      void kick(message.text, message.photo, message.messageId, list.id);
      async function kick(
        text: string,
        photo: Photo | null,
        messageId: string,
        listId: string,
      ) {
        const files = photo ? [await uploadPhoto(listId, photo)] : [];
        await runTurn(userMessage(text, messageId, files));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list]),
  );

  const shown = useMemo((): Shown[] => {
    const out: Shown[] = rows.map((r) => ({
      id: r.id,
      role: r.role ?? "assistant",
      parts: parseParts(r.parts),
    }));
    const synced = new Set(rows.map((r) => r.id));
    for (const m of pending) {
      if (!synced.has(m.id))
        out.push({ id: m.id, role: "user", parts: m.parts });
    }
    if (inFlight && !synced.has(inFlight.id)) {
      out.push({ id: inFlight.id, role: "assistant", parts: inFlight.parts });
    }
    return out;
  }, [rows, pending, inFlight]);

  const last = shown[shown.length - 1];
  const suggestions =
    last?.role === "assistant" ? suggestionsOf(last.parts) : [];

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const settled = useRef(false);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: chat?.title ?? "Chat",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? insets.top + NAV_BAR : 0
        }
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-5 pb-4"
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // Open at the bottom of an existing chat; follow the reply as
            // it streams. Otherwise leave the reader where they are.
            if (!settled.current && shown.length) {
              settled.current = true;
              scrollRef.current?.scrollToEnd({ animated: false });
            } else if (busy) {
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          <View className="gap-5 pt-3">
            {shown.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} parts={m.parts} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  parts={m.parts}
                  streaming={busy && m.id === inFlight?.id}
                  onIdea={(idea) =>
                    void send(`Tell me more about ${idea.title}.`)
                  }
                  onSavePlan={
                    !busy && m.id === last?.id
                      ? (dish) =>
                          router.push({
                            pathname: "/variant/plan",
                            params: { dish },
                          } as never)
                      : undefined
                  }
                />
              ),
            )}
            {busy && (!inFlight || inFlight.parts.length === 0) ? (
              <Waiting />
            ) : null}
            <Text variant="small" className="text-muted-foreground">
              {`DEBUG list=${list ? "yes" : "no"} busy=${busy} inFlight=${
                inFlight ? `yes(${inFlight.parts.length} parts)` : "no"
              } pending=${pending.length} rows=${rows.length} error=${error ? "yes" : "no"}`}
            </Text>
            {error ? (
              <Text
                variant="small"
                className="text-destructive"
                onPress={() => {
                  if (busyRef.current) return;
                  void runTurn(error.failed);
                }}
              >
                {error.text} Tap to retry.
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <Composer
          placeholder="Message"
          busy={busy || !list || !chat}
          suggestions={suggestions}
          onSend={(text, photo) => void send(text, photo)}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
