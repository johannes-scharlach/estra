import * as Crypto from "expo-crypto";
import { Link, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { dishMessage, entryMessage } from "@/features/chat/compose";
import { EntrySelector } from "@/features/chat/entry-selector";
import {
  pickImageAttachments,
  type ImageAttachment,
  type ImageSource,
} from "@/features/chat/image-attachment";
import { ImageAttachmentMenu } from "@/features/chat/image-attachment-menu";
import { queueMessage } from "@/features/chat/message-queue";
import { SeededDeck } from "@/features/chat/seeded-deck";
import {
  useActiveList,
  useHouseholdAccess,
} from "@/features/onboarding/access";
import { WeekGlance } from "@/features/meals/week-glance";
import { HouseholdAvatars } from "@/features/profile/household-avatars";

const HISTORY_ICON = {
  ios: "clock.arrow.circlepath",
  android: "history",
  web: "history",
} as const;
const ADD_ICON = { ios: "plus.circle", android: "add_circle" } as const;
const REMOVE_ICON = { ios: "xmark", android: "close", web: "close" } as const;
const SUBMIT_ICON = { ios: "arrow.up.circle.fill", android: "arrow_circle_up" } as const;

/**
 * Home starts a spontaneous meal from ingredients or a dish in mind.
 * These are independent entry points, not one combined form. Submitting pushes
 * the chat screen with the first message already written — the words are
 * the user's, assembled plainly (ADR 9).
 */
export default function Home() {
  const router = useRouter();
  const iconColor = useResolveClassNames("text-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const { listId } = useHouseholdAccess();
  const list = useActiveList();
  const primaryColor = useResolveClassNames("text-primary").color;

  const [entry, setEntry] = useState<"ingredients" | "dish">("ingredients");
  const [draft, setDraft] = useState("");
  const [dish, setDish] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const ingredientRef = useRef<TextInput>(null);
  const dishRef = useRef<TextInput>(null);
  const startRef = useRef<View>(null);

  // Typing into either field must not hide the entry block behind the keyboard.
  const revealStart = useCallback(() => {
    const top = keyboardTop.current;
    const focused = TextInput.State.currentlyFocusedInput();
    if (top === null) return;
    if (focused !== ingredientRef.current && focused !== dishRef.current) return;
    startRef.current?.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + 16 - top;
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollY.current + overlap });
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      revealStart();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [revealStart]);

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

  async function addAttachments(source: ImageSource) {
    setAttachmentError(null);
    try {
      const picked = await pickImageAttachments(source);
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

  const submitButton = (
    <Pressable
      onPress={start}
      disabled={!canStart}
      accessibilityLabel="Get ideas"
      accessibilityRole="button"
      hitSlop={{ right: 4 }}
      className="h-12 w-10 items-center justify-center self-end active:opacity-60"
      style={canStart ? undefined : { opacity: 0.35 }}
    >
      <SymbolView
        name={SUBMIT_ICON}
        tintColor={canStart ? primaryColor : mutedColor}
        size={26}
      />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: list?.name ?? "Home",
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/household" as never)}
              hitSlop={8}
              accessibilityLabel="Household and account"
              accessibilityRole="button"
              className="p-1"
            >
              <HouseholdAvatars listId={listId} />
            </Pressable>
          ),
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
        ref={scrollRef}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        // The ScrollView is the screen's first native view, so the large
        // title collapses with it.
        className="flex-1 bg-background"
        contentContainerClassName="pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
      >
        <WeekGlance listId={listId} />

        <View className="mx-4 mt-8 gap-3">
          <Text className="text-xl font-semibold">Spontaneous meal</Text>
          <EntrySelector
            value={entry}
            onChange={(value) => {
              Keyboard.dismiss();
              setEntry(value);
            }}
          />

          {/* What the keyboard must not cover. */}
          <View ref={startRef} onLayout={revealStart}>
            {entry === "dish" ? (
              <View className="min-h-12 flex-row items-center rounded-2xl bg-muted pr-1">
                <Input
                  ref={dishRef}
                  value={dish}
                  onChangeText={setDish}
                  placeholder="What would you like to make?"
                  accessibilityLabel="Dish in mind"
                  className="h-12 flex-1 bg-transparent px-3.5"
                  autoCapitalize="sentences"
                  autoCorrect
                  returnKeyType="go"
                  submitBehavior="submit"
                  onSubmitEditing={start}
                />
                {submitButton}
              </View>
            ) : (
              // One field: ingredients and photos sit inside it as tokens,
              // ahead of the text you are typing.
              <Pressable
                onPress={() => ingredientRef.current?.focus()}
                accessible={false}
                className="min-h-12 flex-row items-center rounded-2xl bg-muted pl-2 pr-1"
              >
                <View className="flex-1 flex-row flex-wrap items-center gap-1.5 py-2">
                  {chips.map((chip, i) => (
                    <Pressable
                      key={`${i}-${chip}`}
                      onPress={() => removeChip(i)}
                      accessibilityLabel={`Remove ${chip}`}
                      accessibilityRole="button"
                      hitSlop={{ top: 6, bottom: 6 }}
                      className="h-8 flex-row items-center gap-1.5 rounded-full bg-card pl-3 pr-2.5 active:bg-accent"
                    >
                      <Text className="text-sm">{chip}</Text>
                      <SymbolView
                        name={REMOVE_ICON}
                        tintColor={mutedColor}
                        size={10}
                        weight="bold"
                      />
                    </Pressable>
                  ))}
                  {attachments.map((attachment, i) => (
                    <Pressable
                      key={`${i}-${attachment.uri}`}
                      onPress={() =>
                        setAttachments((current) =>
                          current.filter((_, j) => j !== i),
                        )
                      }
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      accessibilityRole="button"
                      hitSlop={{ top: 6, bottom: 6 }}
                      className="h-8 flex-row items-center gap-1.5 rounded-full bg-card pl-1 pr-2.5 active:bg-accent"
                    >
                      <Image
                        source={{ uri: attachment.uri }}
                        contentFit="cover"
                        style={{ width: 24, height: 24, borderRadius: 12 }}
                      />
                      <Text className="text-sm">Photo</Text>
                      <SymbolView
                        name={REMOVE_ICON}
                        tintColor={mutedColor}
                        size={10}
                        weight="bold"
                      />
                    </Pressable>
                  ))}
                  <Input
                    ref={ingredientRef}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={
                      chips.length || attachments.length
                        ? "Add more…"
                        : "Two or three things you have…"
                    }
                    accessibilityLabel="Ingredient"
                    className="h-8 min-w-24 flex-1 rounded-none bg-transparent px-1.5 py-0"
                    autoCapitalize="sentences"
                    autoCorrect
                    returnKeyType="go"
                    submitBehavior="submit"
                    onSubmitEditing={submitIngredient}
                  />
                </View>
                {trimmed.length > 0 ? (
                  <Pressable
                    onPress={submitIngredient}
                    accessibilityLabel="Add ingredient"
                    accessibilityRole="button"
                    className="h-12 w-10 items-center justify-center self-end active:opacity-60"
                  >
                    <SymbolView name={ADD_ICON} tintColor={iconColor} size={22} />
                  </Pressable>
                ) : (
                  <View className="h-12 w-10 items-center justify-center self-end">
                    <ImageAttachmentMenu
                      onSelect={(source) => void addAttachments(source)}
                      accessibilityLabel="Add images of what you have"
                    />
                  </View>
                )}
                {submitButton}
              </Pressable>
            )}
          </View>

          {attachmentError ? (
            <Text className="text-destructive" accessibilityRole="alert">
              {attachmentError}
            </Text>
          ) : null}
        </View>

        <View className="mx-4 mt-8 gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xl font-semibold">Start from an idea</Text>
            <Link href="/chats/ideas" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="See all ideas"
                hitSlop={12}
                className="active:opacity-60"
              >
                <Text className="text-link">See all</Text>
              </Pressable>
            </Link>
          </View>
          <SeededDeck preview onPick={startChat} />
        </View>
      </ScrollView>
    </>
  );
}
