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
import { View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { Text } from "@/components/ui/text";
import type { Chat, ChatMessage, List } from "@/db/schema";
import { attachUploadedImage, type ChatTurn } from "@/features/chat/chat-turn";
import { Composer } from "@/features/chat/composer";
import { AssistantMessage, UserMessage } from "@/features/chat/message";
import {
  peekQueuedMessage,
  takeQueuedMessage,
} from "@/features/chat/message-queue";
import {
  uploadImageAttachment,
  type ImageAttachment,
} from "@/features/chat/image-attachment";
import {
  parseParts,
  streamReply,
  suggestionsOf,
  userMessage,
  type AssistantUIMessage,
  type Parts,
} from "@/features/chat/stream";
import { Waiting } from "@/features/chat/waiting";

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
    // Local echo of the queued message minus its images (the file parts
    // come from the async uploads): the bubble shows immediately.
    queuedMsg ? [userMessage(queuedMsg.text, queuedMsg.messageId, [])] : [],
  );
  const [inFlight, setInFlight] = useState<AssistantUIMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    turn: ChatTurn;
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
   * One turn: local echo, image uploads, stream, persist (server-side). The state
   * updates live behind an async boundary so the kick-off effect below
   * never sets state in its synchronous window.
   */
  const busyRef = useRef(false);
  async function runTurn(turn: ChatTurn) {
    if (!list || busyRef.current) return;
    busyRef.current = true;
    await Promise.resolve();
    setInFlight(null);
    setError(null);
    setBusy(true);
    try {
      setPending((p) => [
        ...p.filter((m) => m.id !== turn.message.id),
        turn.message,
      ]);
      while (turn.attachments.length) {
        const file = await uploadImageAttachment(list.id, turn.attachments[0]!);
        turn = attachUploadedImage(turn, file);
        const uploaded = turn.message;
        setPending((p) => p.map((m) => (m.id === uploaded.id ? uploaded : m)));
      }
      for await (const reply of streamReply({
        chatId,
        listId: list.id,
        message: turn.message,
      })) {
        setInFlight(reply);
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // An empty in-flight reply must not linger over the error.
      setInFlight(null);
      setError({
        text: e instanceof Error ? e.message : "Something went wrong",
        turn,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function send(
    text: string,
    attachments: ImageAttachment[] = [],
    id2 = Crypto.randomUUID(),
  ) {
    await runTurn({ message: userMessage(text, id2), attachments });
  }

  // Send a queued message on focus — on mount for a fresh chat (the
  // queue is its first message), or on return from the plan sheet for one
  // already mid-conversation. take() makes re-runs (StrictMode double
  // effects, list identity changes) no-ops.
  useFocusEffect(
    useCallback(() => {
      if (!list || busyRef.current) return;
      const message = takeQueuedMessage();
      if (!message) return;
      void runTurn({
        message: userMessage(message.text, message.messageId),
        attachments: message.attachments,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list, busy]),
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

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const settled = useRef(false);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: chat?.title ?? "Chat",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View className="flex-1">
        <KeyboardAwareScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="pb-4"
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
            {error ? (
              <Text
                variant="small"
                className="mx-5 text-destructive"
                onPress={() => {
                  if (busyRef.current) return;
                  void runTurn(error.turn);
                }}
              >
                {error.text} Tap to retry.
              </Text>
            ) : null}
          </View>
        </KeyboardAwareScrollView>

        <KeyboardStickyView>
          <Composer
            placeholder="Message"
            busy={busy || !list || !chat}
            suggestions={suggestions}
            onSend={(text, attachments) => void send(text, attachments)}
          />
        </KeyboardStickyView>
      </View>
    </View>
  );
}
