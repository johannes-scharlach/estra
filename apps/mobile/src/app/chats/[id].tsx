import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import {
  Stack,
  Link,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import type { Chat, ChatMessage, Variant } from "@/db/schema";
import { waitForListMembership } from "@/db/list-readiness";
import { waitForPlannedMeal } from "@/db/meal-readiness";
import { attachUploadedImage, type ChatTurn } from "@/features/chat/chat-turn";
import { activitySteps } from "@/features/chat/activity";
import { ActivityView } from "@/features/chat/activity-view";
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
  messageText,
  ChatRequestRejected,
  parseParts,
  readChatTurn,
  streamReply,
  suggestionsOf,
  turnState,
  userMessage,
  type AssistantUIMessage,
  type Parts,
} from "@/features/chat/stream";
import { latestRecipeResult } from "@/features/chat/recipe-results";
import { useActiveList } from "@/features/onboarding/access";
import { posthog } from "@/lib/posthog";

type Shown = { id: string; role: string; parts: Parts };

const TRANSCRIPT_TOP = 12;
const TRANSCRIPT_BOTTOM = 16;

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

  const list = useActiveList();

  const { data: chats } = useQuery<Chat>("SELECT * FROM chats WHERE id = ?", [
    chatId,
  ]);
  const { data: rows, isLoading: messagesLoading } = useQuery<ChatMessage>(
    "SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at, id",
    [chatId],
  );

  // A queued message rides beside the push (the entry's "Get ideas", or
  // the plan sheet's confirm). Read once at mount for the optimistic
  // echo; the focus effect below sends it.
  const [queuedMsg] = useState(() => peekQueuedMessage(chatId));
  const conversationListId = chats[0]?.list_id ?? queuedMsg?.listId ?? list?.id;
  const [anchor, setAnchor] = useState<{ id: string; y: number | null } | null>(
    queuedMsg ? { id: queuedMsg.messageId, y: null } : null,
  );
  const pendingScroll = useRef(queuedMsg?.messageId ?? null);

  const [pending, setPending] = useState<AssistantUIMessage[]>(() =>
    // Local echo of the queued message minus its images (the file parts
    // come from the async uploads): the bubble shows immediately.
    queuedMsg ? [userMessage(queuedMsg.text, queuedMsg.messageId, [])] : [],
  );
  const [inFlight, setInFlight] = useState<AssistantUIMessage | null>(null);
  const [activeTurn, setActiveTurn] = useState<ChatTurn | null>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sendError, setSendError] = useState<{
    text: string;
    turn: ChatTurn;
    retryable: boolean;
  } | null>(null);
  const syncedMessages = useMemo(
    (): Shown[] =>
      rows.map((row) => ({
        id: row.id,
        role: row.role ?? "assistant",
        parts: parseParts(row.parts),
      })),
    [rows],
  );
  const activeMessageId = activeTurn?.message.id;
  const syncedState = syncedMessages
    .filter((message) => message.role === "assistant")
    .map((message) => turnState(message.parts))
    .find((state) => state && state.userMessageId === activeMessageId);
  const liveState = turnState(inFlight?.parts ?? []);
  const savedPreviewState = pending
    .filter((message) => message.role === "assistant")
    .map((message) => turnState(message.parts))
    .find(
      (state) =>
        state &&
        state.userMessageId === activeMessageId &&
        state.status !== "running",
    );
  const activeState =
    syncedState && syncedState.status !== "running"
      ? syncedState
      : (savedPreviewState ??
        (liveState?.userMessageId === activeMessageId
          ? liveState
          : syncedState));
  const received = rows.some(
    (row) => row.id === activeMessageId && row.role === "user",
  );
  const error = received || syncedState ? null : sendError;
  const awaitingReply =
    !!activeTurn &&
    !error &&
    (!activeState || activeState.status === "running");
  const resolved = !!syncedState && syncedState.status !== "running";
  const latestSyncedMessage = syncedMessages.at(-1);
  const latestSyncedState =
    latestSyncedMessage?.role === "assistant"
      ? turnState(latestSyncedMessage.parts)
      : null;
  const serverRunning =
    latestSyncedState?.status === "running" &&
    !pending.some(
      (message) =>
        message.role === "assistant" &&
        turnState(message.parts)?.userMessageId ===
          latestSyncedState.userMessageId &&
        turnState(message.parts)?.status !== "running",
    ) &&
    !(
      liveState?.userMessageId === latestSyncedState.userMessageId &&
      liveState.status !== "running"
    );
  const busy = (sending && !resolved) || awaitingReply || serverRunning;

  // Until the chat row exists this optimistic copy stands in, so the
  // header title and composer are live from the first frame.
  const chat: Chat | null =
    chats[0] ??
    (queuedMsg
      ? ({
          id: chatId,
          list_id: conversationListId ?? "",
          title: queuedMsg.text.slice(0, 80) || null,
          recipe_id: queuedMsg.recipeContext?.recipeId ?? null,
          initial_variant_id: queuedMsg.recipeContext?.variantId ?? null,
          planned_meal_id:
            queuedMsg.mealContext?.plannedMealId ??
            queuedMsg.recipeContext?.plannedMealId ??
            null,
        } as Chat)
      : null);

  /**
   * One turn: local echo, image uploads, stream, persist (server-side). The state
   * updates live behind an async boundary so the kick-off effect below
   * never sets state in its synchronous window.
   */
  const busyRef = useRef(false);
  const liveRequest = useRef<{
    messageId: string;
    controller: AbortController;
  } | null>(null);
  useEffect(() => {
    if (
      syncedState &&
      syncedState.status !== "running" &&
      liveRequest.current?.messageId === syncedState.userMessageId
    )
      liveRequest.current.controller.abort();
  }, [syncedState]);
  async function runTurn(turn: ChatTurn) {
    if (!conversationListId || busyRef.current || busy) return;
    busyRef.current = true;
    let lastReply: AssistantUIMessage | null = null;
    let submitted = false;
    await Promise.resolve();
    if (anchor?.id !== turn.message.id) {
      pendingScroll.current = turn.message.id;
      setAnchor({ id: turn.message.id, y: null });
    }
    setInFlight(null);
    setActiveTurn(turn);
    setChecking(false);
    setSendError(null);
    setSending(true);
    try {
      setPending((p) => [
        ...p.filter((m) => m.id !== turn.message.id),
        turn.message,
      ]);
      await waitForListMembership(conversationListId);
      if (queuedMsg?.mealContext) {
        await waitForPlannedMeal(
          conversationListId,
          queuedMsg.mealContext.plannedMealId,
        );
      }
      while (turn.attachments.length) {
        const file = await uploadImageAttachment(
          conversationListId,
          turn.attachments[0]!,
        );
        turn = attachUploadedImage(turn, file);
        const uploaded = turn.message;
        setPending((p) => p.map((m) => (m.id === uploaded.id ? uploaded : m)));
      }
      setActiveTurn(turn);
      const controller = new AbortController();
      liveRequest.current = { messageId: turn.message.id, controller };
      submitted = true;
      for await (const reply of streamReply({
        chatId,
        listId: conversationListId,
        message: turn.message,
        signal: controller.signal,
        recipeContext: queuedMsg?.recipeContext,
        mealContext: queuedMsg?.mealContext,
      })) {
        lastReply = reply;
        setInFlight(reply);
      }
      if (
        !lastReply ||
        !turnState(lastReply.parts) ||
        turnState(lastReply.parts)?.status === "running"
      )
        setChecking(true);
      else {
        const completed = lastReply;
        setPending((messages) => [
          ...messages.filter((message) => message.id !== completed.id),
          completed,
        ]);
      }
    } catch (e) {
      if (!submitted || e instanceof ChatRequestRejected) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSendError({
          text:
            e instanceof ChatRequestRejected
              ? e.message
              : "Your message couldn't be sent.",
          turn,
          retryable: !(e instanceof ChatRequestRejected) || e.retryable,
        });
      } else {
        // A lost preview tells us nothing about the server's outcome. Keep
        // waiting, without an error buzz or a resend of an accepted request.
        setInFlight(null);
        setChecking(true);
      }
    } finally {
      liveRequest.current = null;
      busyRef.current = false;
      setSending(false);
    }
  }

  useEffect(() => {
    if (!checking || !awaitingReply || !activeTurn || !conversationListId)
      return;
    const turn = activeTurn;
    const listId = conversationListId;
    let canceled = false;
    let reading = false;
    async function reconcile() {
      if (reading || AppState.currentState !== "active") return;
      reading = true;
      try {
        const result = await readChatTurn({
          chatId,
          listId,
          userMessageId: turn.message.id,
        });
        if (canceled) return;
        if (!result.received) {
          setSendError({
            text: "Your message wasn't received.",
            turn,
            retryable: true,
          });
          setChecking(false);
        } else if (result.reply) {
          // Old replies have no lifecycle part; new turns always have one.
          const reply = result.reply;
          if (!turnState(reply.parts)) {
            const incomplete = reply.parts.some(
              (part) => part.type === "text" && part.state === "streaming",
            );
            reply.parts.push({
              type: "data-turn",
              data: {
                userMessageId: turn.message.id,
                status: incomplete ? "failed" : "completed",
                ...(incomplete
                  ? {
                      error:
                        "This reply was interrupted. Any changes already made are kept.",
                    }
                  : {}),
              },
            });
          }
          setInFlight(reply);
          if (turnState(reply.parts)?.status !== "running")
            setPending((messages) => [
              ...messages.filter((message) => message.id !== reply.id),
              reply,
            ]);
          setSendError(null);
        }
      } catch {
        // Still unknown. Neither offline nor a failed status check is proof
        // the user's request failed. PowerSync can also resolve this wait.
      } finally {
        reading = false;
      }
    }
    void reconcile();
    const interval = setInterval(() => {
      void reconcile();
    }, 3000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcile();
    });
    return () => {
      canceled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [checking, awaitingReply, activeTurn, conversationListId, chatId]);

  async function send(
    text: string,
    attachments: ImageAttachment[] = [],
    id2 = Crypto.randomUUID(),
  ) {
    posthog?.capture("chat_message_sent", {
      has_attachments: attachments.length > 0,
    });
    await runTurn({ message: userMessage(text, id2), attachments });
  }

  // Send a queued message on focus — on mount for a fresh chat (the
  // queue is its first message), or on return from the plan sheet for one
  // already mid-conversation. take() makes re-runs (StrictMode double
  // effects, list identity changes) no-ops.
  useFocusEffect(
    useCallback(() => {
      if (!conversationListId || busyRef.current || busy) return;
      const message = takeQueuedMessage(chatId);
      if (!message) return;
      void runTurn({
        message: userMessage(message.text, message.messageId),
        attachments: message.attachments,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationListId, busy]),
  );

  const shown = useMemo((): Shown[] => {
    const savedReplies = new Map(
      pending
        .filter((message) => message.role === "assistant")
        .map((message) => [message.id, message]),
    );
    const out: Shown[] = syncedMessages.map((message) => {
      const state = turnState(message.parts);
      const saved = savedReplies.get(message.id);
      if (saved && (!state || state.status === "running"))
        return { ...message, parts: saved.parts };
      if (
        message.id === inFlight?.id &&
        (state?.status === "running" || (!state && turnState(inFlight.parts)))
      )
        return { ...message, parts: inFlight.parts };
      return message;
    });
    const synced = new Set(rows.map((r) => r.id));
    for (const m of pending) {
      if (!synced.has(m.id))
        out.push({ id: m.id, role: m.role, parts: m.parts });
    }
    if (
      inFlight &&
      !synced.has(inFlight.id) &&
      !out.some((message) => message.id === inFlight.id)
    ) {
      out.push({ id: inFlight.id, role: "assistant", parts: inFlight.parts });
    }
    return out;
  }, [rows, syncedMessages, pending, inFlight]);

  const last = shown[shown.length - 1];
  const suggestions =
    !busy &&
    last?.role === "assistant" &&
    turnState(last.parts)?.status !== "failed"
      ? suggestionsOf(last.parts)
      : [];
  const latestRecipe = latestRecipeResult(shown);
  const linkedVariantId =
    latestRecipe?.variantId ?? chat?.initial_variant_id ?? "";
  const { data: linkedVariants } = useQuery<Variant>(
    "SELECT * FROM variants WHERE id = ?",
    [linkedVariantId],
  );
  const linkedName =
    latestRecipe?.name ?? linkedVariants[0]?.name ?? "View recipe";

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const settled = useRef(false);
  const contentHeight = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const scrollToTurn = useCallback(() => {
    if (
      !anchor ||
      anchor.y === null ||
      pendingScroll.current !== anchor.id ||
      messagesLoading ||
      !viewportHeight
    )
      return;

    const y = Math.max(0, anchor.y - TRANSCRIPT_TOP);
    // Wait for the reserved space to reach native layout before scrolling.
    if (contentHeight.current < y + viewportHeight - 1) return;
    scrollRef.current?.scrollTo({ y, animated: settled.current });
    pendingScroll.current = null;
    settled.current = true;
  }, [anchor, messagesLoading, viewportHeight]);

  useEffect(scrollToTurn, [scrollToTurn]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: chat?.title ?? "Chat",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      {chat?.recipe_id && linkedVariantId ? (
        <Link
          href={{
            pathname: "/variant/[id]",
            params: {
              id: linkedVariantId,
              plannedMealId: latestRecipe?.plannedMeal?.id,
            },
          }}
          asChild
        >
          <Pressable
            className="gap-0.5 border-b border-border/40 bg-secondary px-5 py-2.5 active:opacity-60"
            accessibilityRole="link"
          >
            <Text variant="muted" className="text-xs">
              {latestRecipe ? "Latest variant from this chat" : "Started from"}
            </Text>
            <Text numberOfLines={1} className="font-medium text-primary">
              {linkedName} →
            </Text>
          </Pressable>
        </Link>
      ) : null}
      <View className="flex-1">
        <KeyboardAwareScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: TRANSCRIPT_BOTTOM }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          onScrollBeginDrag={() => {
            pendingScroll.current = null;
            settled.current = true;
          }}
          onContentSizeChange={(_, height) => {
            contentHeight.current = height;
            scrollToTurn();
            // History opens at the bottom. Sending only scrolls once, to
            // the user message; streaming never moves the reader.
            if (
              !settled.current &&
              !anchor &&
              !messagesLoading &&
              shown.length
            ) {
              settled.current = true;
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
        >
          <View
            className="gap-5"
            style={{
              paddingTop: TRANSCRIPT_TOP,
              // Keep a viewport beneath the turn's start, even after a
              // short reply finishes. Longer replies consume the space.
              minHeight:
                anchor?.y != null
                  ? Math.max(0, anchor.y - TRANSCRIPT_TOP) +
                    viewportHeight -
                    TRANSCRIPT_BOTTOM
                  : undefined,
            }}
          >
            {shown.map((m) => {
              if (m.role === "user")
                return (
                  <View
                    key={m.id}
                    onLayout={(e) => {
                      const { y } = e.nativeEvent.layout;
                      setAnchor((current) =>
                        current?.id === m.id && current.y !== y
                          ? { id: m.id, y }
                          : current,
                      );
                    }}
                  >
                    <UserMessage parts={m.parts} />
                  </View>
                );
              const state = turnState(m.parts);
              const messageBusy = state
                ? state.status === "running"
                : sending && m.id === inFlight?.id;
              const steps = activitySteps(m.parts, messageBusy);
              return (
                <View key={m.id}>
                  {messageBusy || steps.length > 0 ? (
                    <ActivityView
                      steps={steps}
                      busy={messageBusy}
                      writing={messageText(m.parts).length > 0}
                      waiting={
                        checking && state?.userMessageId === activeMessageId
                      }
                    />
                  ) : null}
                  <AssistantMessage
                    parts={m.parts}
                    streaming={messageBusy}
                    showRecipeResults={!!chat?.recipe_id}
                    onIdea={(idea) =>
                      void send(`Tell me more about ${idea.title}.`)
                    }
                    onSavePlan={
                      !busy && state?.status !== "failed" && m.id === last?.id
                        ? (dish) =>
                            router.push({
                              pathname: "/variant/plan",
                              params: { dish },
                            } as never)
                        : undefined
                    }
                  />
                  {state?.status === "failed" ? (
                    <View className="mx-5 mt-2 gap-2">
                      <Text variant="muted" selectable>
                        {state.error ??
                          "This reply was interrupted. Any changes already made are kept."}
                      </Text>
                      {!busy && m.id === last?.id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="self-start"
                          onPress={() => {
                            void send(
                              "Please continue from where you stopped.",
                            );
                          }}
                        >
                          <Text>Continue</Text>
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {busy &&
            !shown.some(
              (message) =>
                turnState(message.parts)?.status === "running" ||
                (sending && message.id === inFlight?.id),
            ) ? (
              <ActivityView
                steps={[]}
                busy
                writing={false}
                waiting={checking}
              />
            ) : null}
            {error ? (
              <View className="mx-5 gap-2">
                <Text variant="small" className="text-destructive" selectable>
                  {error.text}
                </Text>
                {error.retryable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={busy}
                    onPress={() => {
                      void runTurn(error.turn);
                    }}
                  >
                    <Text>Try sending again</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        </KeyboardAwareScrollView>

        <KeyboardStickyView>
          <Composer
            placeholder="Message"
            busy={busy || !conversationListId || !chat}
            suggestions={suggestions}
            onSend={(text, attachments) => void send(text, attachments)}
          />
        </KeyboardStickyView>
      </View>
    </View>
  );
}
