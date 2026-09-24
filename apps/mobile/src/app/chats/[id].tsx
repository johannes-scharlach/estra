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
import { Pressable, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { Text } from "@/components/ui/text";
import type { Chat, ChatMessage, Variant } from "@/db/schema";
import { waitForListMembership } from "@/db/list-readiness";
import { waitForPlannedMeal } from "@/db/meal-readiness";
import { attachUploadedImage, type ChatTurn } from "@/features/chat/chat-turn";
import { activitySteps, type ActivityStep } from "@/features/chat/activity";
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
  parseParts,
  streamReply,
  suggestionsOf,
  userMessage,
  type AssistantUIMessage,
  type Parts,
} from "@/features/chat/stream";
import { latestRecipeResult } from "@/features/chat/recipe-results";
import { useActiveList } from "@/features/onboarding/access";

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
  const [orphanedActivity, setOrphanedActivity] = useState<ActivityStep[]>([]);
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
  async function runTurn(turn: ChatTurn) {
    if (!conversationListId || busyRef.current) return;
    busyRef.current = true;
    let lastReply: AssistantUIMessage | null = null;
    await Promise.resolve();
    if (anchor?.id !== turn.message.id) {
      pendingScroll.current = turn.message.id;
      setAnchor({ id: turn.message.id, y: null });
    }
    setInFlight(null);
    setOrphanedActivity([]);
    setError(null);
    setBusy(true);
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
      for await (const reply of streamReply({
        chatId,
        listId: conversationListId,
        message: turn.message,
        recipeContext: queuedMsg?.recipeContext,
        mealContext: queuedMsg?.mealContext,
      })) {
        lastReply = reply;
        setInFlight(reply);
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Keep tool activity visible even when a failed stream's partial reply
      // cannot safely remain in the transcript.
      setOrphanedActivity(activitySteps(lastReply?.parts ?? [], false));
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
      if (!conversationListId || busyRef.current) return;
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
            {shown.map((m) =>
              m.role === "user" ? (
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
              ) : (
                <View key={m.id}>
                  {(busy && m.id === inFlight?.id) ||
                  activitySteps(m.parts, false).length > 0 ? (
                    <ActivityView
                      steps={activitySteps(
                        m.parts,
                        busy && m.id === inFlight?.id,
                      )}
                      busy={busy && m.id === inFlight?.id}
                      writing={messageText(m.parts).length > 0}
                    />
                  ) : null}
                  <AssistantMessage
                    parts={m.parts}
                    streaming={busy && m.id === inFlight?.id}
                    showRecipeResults={!!chat?.recipe_id}
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
                </View>
              ),
            )}
            {busy && !inFlight ? (
              <ActivityView steps={[]} busy writing={false} />
            ) : null}
            {!busy && orphanedActivity.length ? (
              <ActivityView steps={orphanedActivity} busy={false} />
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
            busy={busy || !conversationListId || !chat}
            suggestions={suggestions}
            onSend={(text, attachments) => void send(text, attachments)}
          />
        </KeyboardStickyView>
      </View>
    </View>
  );
}
