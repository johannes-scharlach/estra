import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { pickPhoto, type Photo } from "./photo";

const SEND_ICON = { ios: "arrow.up", android: "arrow_upward", web: "arrow_upward" } as const;
const CAMERA_ICON = { ios: "camera", android: "photo_camera", web: "photo_camera" } as const;
const REMOVE_ICON = { ios: "xmark", android: "close", web: "close" } as const;

/**
 * Text and one photo. Keyboard dictation already covers voice. Suggested
 * replies sit above the bar: actions live here, never in the content, and
 * tapping one just sends it (ADR 9).
 */
export function Composer({
  placeholder,
  busy,
  suggestions,
  onSend,
}: {
  placeholder: string;
  busy: boolean;
  suggestions: string[];
  onSend: (text: string, photo: Photo | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const iconColor = useResolveClassNames("text-primary-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const canSend = (text.trim().length > 0 || photo !== null) && !busy;

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !photo) || busy) return;
    setText("");
    setPhoto(null);
    onSend(trimmed, photo);
  }

  async function addPhoto() {
    const picked = await pickPhoto();
    if (picked) setPhoto(picked);
  }

  return (
    <View
      className="border-t border-border/40 bg-background"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {suggestions.length && !busy ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 px-4 pt-2"
        >
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                onSend(s, null);
              }}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 active:bg-accent"
            >
              <Text className="text-sm">{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {photo ? (
        <View className="flex-row px-4 pt-2">
          <View>
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              style={{ width: 72, height: 72, borderRadius: 12 }}
            />
            <Pressable
              onPress={() => setPhoto(null)}
              hitSlop={8}
              accessibilityLabel="Remove photo"
              className="absolute -right-2 -top-2 size-6 items-center justify-center rounded-full bg-muted"
            >
              <SymbolView name={REMOVE_ICON} tintColor={mutedColor} size={11} weight="bold" />
            </Pressable>
          </View>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2 px-4 pt-2">
        <Pressable
          onPress={() => void addPhoto()}
          disabled={busy}
          hitSlop={8}
          accessibilityLabel="Add a photo"
          accessibilityRole="button"
          className="mb-0.5 size-9 items-center justify-center rounded-full"
        >
          <SymbolView name={CAMERA_ICON} tintColor={mutedColor} size={22} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          multiline
          returnKeyType="send"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
          className="max-h-32 min-h-10 flex-1 rounded-[20px] border border-border bg-background px-4 py-2.5 text-base leading-5 text-foreground"
        />
        <Pressable
          onPress={submit}
          disabled={!canSend}
          accessibilityLabel="Send"
          accessibilityRole="button"
          className={cn(
            "mb-0.5 size-9 items-center justify-center rounded-full bg-primary",
            !canSend && "opacity-30",
          )}
        >
          <SymbolView name={SEND_ICON} tintColor={iconColor} size={16} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}
