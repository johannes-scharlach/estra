import * as Crypto from "expo-crypto";
import { Link, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { dishMessage, entryMessage } from "@/features/chat/compose";
import { EntrySelector } from "@/features/chat/entry-selector";
import {
  pickImageAttachments,
  type ImageAttachment,
} from "@/features/chat/image-attachment";
import { ImageAttachmentStrip } from "@/features/chat/image-attachment-strip";
import { queueMessage } from "@/features/chat/message-queue";
import { SeededDeck } from "@/features/chat/seeded-deck";

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
const ADD_ICON = { ios: "plus.circle", android: "add_circle" } as const;
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
 * Home starts a spontaneous meal from ingredients or a dish in mind.
 * These are independent entry points, not one combined form. "Get ideas" pushes
 * the chat screen with the first message already written — the words are
 * the user's, assembled plainly (ADR 9).
 */
export default function Home() {
  const router = useRouter();
  const iconColor = useResolveClassNames("text-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  const [entry, setEntry] = useState<"ingredients" | "dish">("ingredients");
  const [draft, setDraft] = useState("");
  const [dish, setDish] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const canStart =
    entry === "dish"
      ? dish.trim().length > 0
      : trimmed.length > 0 || chips.length > 0 || attachments.length > 0;

  function submitIngredient() {
    const chip = trimmed;
    if (!chip) {
      start();
      return;
    }
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
    startChat(
      entry === "dish"
        ? dishMessage(dish)
        : entryMessage(chips, attachments.length, draft),
      entry === "dish" ? [] : attachments,
    );
  }

  function startChat(text: string, images: ImageAttachment[] = []) {
    const chatId = Crypto.randomUUID();
    queueMessage({ messageId: Crypto.randomUUID(), text, attachments: images });
    Keyboard.dismiss();
    setChips([]);
    setDraft("");
    setDish("");
    setEntry("ingredients");
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
        contentContainerClassName="px-5 pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
      >
        <Link href="/meals/plan" asChild>
          <Pressable
            accessibilityRole="link"
            className="min-h-14 flex-row items-center gap-3 rounded-xl bg-accent px-4 py-2 active:opacity-60"
          >
            <SymbolView name={CALENDAR_ICON} tintColor={iconColor} size={20} />
            <Text className="flex-1 font-medium">Plan the week</Text>
            <SymbolView
              name={CHEVRON_ICON}
              tintColor={mutedColor}
              size={14}
              weight="semibold"
            />
          </Pressable>
        </Link>

        <View className="mt-6 gap-5">
          <Text className="text-2xl font-semibold tracking-tight">
            Spontaneous meal
          </Text>
          <EntrySelector
            value={entry}
            onChange={(value) => {
              Keyboard.dismiss();
              setEntry(value);
            }}
          />
          <View className="gap-2">
            <Text variant="muted" className="text-sm">
              {entry === "ingredients"
                ? "Two or three things you have is plenty."
                : "Name a dish and explore a few ways to make it."}
            </Text>

            {entry === "dish" ? (
              <Input
                value={dish}
                onChangeText={setDish}
                placeholder="What would you like to make?"
                accessibilityLabel="Dish in mind"
                className="h-12 shadow-none"
                autoCapitalize="sentences"
                autoCorrect
                returnKeyType="go"
                submitBehavior="submit"
                onSubmitEditing={start}
              />
            ) : (
              <View className="gap-3">
                <View className="relative">
                  <Input
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add an ingredient…"
                    accessibilityLabel="Ingredient"
                    className="h-12 pr-14 shadow-none"
                    autoCapitalize="sentences"
                    autoCorrect
                    returnKeyType="done"
                    submitBehavior="submit"
                    onSubmitEditing={submitIngredient}
                  />
                  {trimmed.length > 0 ? (
                    <Pressable
                      onPress={submitIngredient}
                      accessibilityLabel="Add ingredient"
                      accessibilityRole="button"
                      className="absolute bottom-0 right-0 top-0 w-12 items-center justify-center active:opacity-60"
                    >
                      <SymbolView
                        name={ADD_ICON}
                        tintColor={iconColor}
                        size={22}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => void addAttachments()}
                      accessibilityLabel="Add images of what you have"
                      accessibilityRole="button"
                      className="absolute bottom-0 right-0 top-0 w-12 items-center justify-center active:opacity-60"
                    >
                      <SymbolView
                        name={CAMERA_ICON}
                        tintColor={mutedColor}
                        size={22}
                      />
                    </Pressable>
                  )}
                </View>

                {chips.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {chips.map((chip, i) => (
                      <Pressable
                        key={`${i}-${chip}`}
                        onPress={() => removeChip(i)}
                        accessibilityLabel={`Remove ${chip}`}
                        accessibilityRole="button"
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
                  onRemove={(index) =>
                    setAttachments((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  size={96}
                />

                {attachmentError ? (
                  <Text className="text-destructive" accessibilityRole="alert">
                    {attachmentError}
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          <Button
            size="lg"
            disabled={!canStart}
            onPress={start}
            className={canStart ? undefined : "bg-secondary opacity-100"}
          >
            <Text className={canStart ? undefined : "text-muted-foreground"}>
              Get ideas
            </Text>
          </Button>
        </View>

        <View className="mt-7 gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-lg font-semibold">Quick meal ideas</Text>
            <Link href="/chats/ideas" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="See all quick meal ideas"
                className="py-2 active:opacity-60"
              >
                <Text variant="muted">See all</Text>
              </Pressable>
            </Link>
          </View>
          <View className="-mx-5">
            <SeededDeck preview onPick={startChat} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
