import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { pickImageAttachments, type ImageAttachment } from "./image-attachment";
import { ImageAttachmentStrip } from "./image-attachment-strip";

const SEND_ICON = { ios: "arrow.up", android: "arrow_upward", web: "arrow_upward" } as const;
const CAMERA_ICON = { ios: "camera", android: "photo_camera", web: "photo_camera" } as const;

/**
 * Text and image attachments. Keyboard dictation already covers voice. Suggested
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
  onSend: (text: string, attachments: ImageAttachment[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const iconColor = useResolveClassNames("text-primary-foreground").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !busy;

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || busy) return;
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    onSend(trimmed, attachments);
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
                onSend(s, []);
              }}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 active:bg-accent"
            >
              <Text className="text-sm">{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {attachments.length ? (
        <View className="px-2 pt-2">
          <ImageAttachmentStrip
            attachments={attachments}
            onRemove={(index) => setAttachments((current) => current.filter((_, i) => i !== index))}
          />
        </View>
      ) : null}
      {attachmentError ? <Text className="px-4 pt-2 text-destructive" accessibilityRole="alert">{attachmentError}</Text> : null}
      <View className="flex-row items-end gap-2 px-4 pt-2">
        <Pressable
          onPress={() => void addAttachments()}
          disabled={busy}
          hitSlop={8}
          accessibilityLabel="Add images"
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
