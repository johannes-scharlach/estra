import * as Crypto from "expo-crypto";
import { Link, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View, type TextInput } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { entryMessage } from "@/features/chat/compose";
import { pickImageAttachments, type ImageAttachment } from "@/features/chat/image-attachment";
import { ImageAttachmentStrip } from "@/features/chat/image-attachment-strip";
import { queueMessage } from "@/features/chat/message-queue";

const HISTORY_ICON = {
  ios: "clock.arrow.circlepath",
  android: "history",
  web: "history",
} as const;
const CAMERA_ICON = {
  ios: "camera",
  android: "photo_camera",
  web: "photo_camera",
} as const;
const REMOVE_ICON = { ios: "xmark", android: "close", web: "close" } as const;
const CALENDAR_ICON = {
  ios: "calendar",
  android: "calendar_today",
  web: "calendar_today",
} as const;
const CHEVRON_ICON = {
  ios: "chevron.right",
  android: "chevron_right",
  web: "chevron_right",
} as const;

/**
 * Home is the entry point, not a conversation: what do you have, as a
 * short list, like adding items to the shopping list. "Get ideas" pushes
 * the chat screen with the first message already written — the words are
 * the user's, assembled plainly (ADR 9).
 */
export default function Home() {
  const router = useRouter();
  const iconColor = useResolveClassNames("text-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const canStart = chips.length > 0 || attachments.length > 0;

  function addChip() {
    const chip = trimmed;
    if (!chip) return;
    setChips((c) => [...c, chip]);
    setDraft("");
  }

  function removeChip(index: number) {
    setChips((c) => c.filter((_, i) => i !== index));
  }

  async function addAttachments() {
    setAttachmentError(null);
    try {
      const picked = await pickImageAttachments();
      if (picked.length) setAttachments((current) => [...current, ...picked]);
    } catch {
      setAttachmentError("Could not add images. Try again.");
    }
  }

  function start() {
    if (!canStart) return;
    const chatId = Crypto.randomUUID();
    queueMessage({
      messageId: Crypto.randomUUID(),
      text: entryMessage(chips, attachments.length),
      attachments,
    });
    setChips([]);
    setDraft("");
    setAttachments([]);
    setAttachmentError(null);
    router.push(`/chats/${chatId}` as never);
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "Home",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/chats/history")}
              hitSlop={8}
              accessibilityLabel="Past chats"
              accessibilityRole="button"
              className="p-2"
            >
              <SymbolView name={HISTORY_ICON} tintColor={iconColor} size={22} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-1">
          <Text className="text-2xl font-semibold tracking-tight">
            What&rsquo;s on hand?
          </Text>
          <Text variant="muted" className="text-base">
            Two or three things you have is plenty.
          </Text>
        </View>

        <Input
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an ingredient…"
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={addChip}
        />

        {chips.length ? (
          <View className="flex-row flex-wrap gap-2">
            {chips.map((chip, i) => (
              <Pressable
                key={`${i}-${chip}`}
                onPress={() => removeChip(i)}
                accessibilityLabel={`Remove ${chip}`}
                className="flex-row items-center gap-1.5 rounded-full bg-secondary py-1.5 pl-3.5 pr-2.5 active:bg-accent"
              >
                <Text className="text-sm">{chip}</Text>
                <SymbolView
                  name={REMOVE_ICON}
                  tintColor={mutedColor}
                  size={11}
                  weight="bold"
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        <ImageAttachmentStrip
          attachments={attachments}
          onRemove={(index) => setAttachments((current) => current.filter((_, i) => i !== index))}
          size={96}
        />
        <Pressable
          onPress={() => void addAttachments()}
          accessibilityLabel="Add images of what you have"
          accessibilityRole="button"
          className="flex-row items-center gap-2 self-start rounded-full border border-border px-3.5 py-2 active:bg-accent"
        >
          <SymbolView name={CAMERA_ICON} tintColor={mutedColor} size={18} />
          <Text variant="muted" className="text-sm">
            {attachments.length ? "Add more images" : "Or photos of the fridge"}
          </Text>
        </Pressable>

        {attachmentError ? <Text className="text-destructive" accessibilityRole="alert">{attachmentError}</Text> : null}

        <Button size="lg" disabled={!canStart} onPress={start}>
          <Text>Get ideas</Text>
        </Button>

        <Link href="/chats/ideas" asChild>
          <Pressable
            accessibilityRole="link"
            className="self-start py-1 active:opacity-60"
          >
            <Text
              variant="muted"
              className="text-sm underline underline-offset-2"
            >
              30 weeknight ideas, five ingredients or less
            </Text>
          </Pressable>
        </Link>

        <View className="mt-2">
          <Link href="/meals/plan" asChild>
            <Pressable
              accessibilityRole="link"
              className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5 active:bg-accent/50"
            >
              <SymbolView name={CALENDAR_ICON} tintColor={iconColor} size={20} />
              <View className="flex-1 gap-0.5">
                <Text className="font-medium">Plan meals</Text>
                <Text variant="muted" className="text-sm">
                  Draft a meal plan
                </Text>
              </View>
              <SymbolView
                name={CHEVRON_ICON}
                tintColor={mutedColor}
                size={14}
                weight="semibold"
              />
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
