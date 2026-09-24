import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  pickImageAttachments,
  type ImageAttachment,
  type ImageSource,
} from "./image-attachment";
import { ImageAttachmentMenu } from "./image-attachment-menu";
import { ImageAttachmentStrip } from "./image-attachment-strip";

const SEND_ICON = {
  ios: "arrow.up",
  android: "arrow_upward",
  web: "arrow_upward",
} as const;

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
  floating = false,
  emptyAction,
}: {
  placeholder: string;
  busy: boolean;
  suggestions: string[];
  onSend: (text: string, attachments: ImageAttachment[]) => void;
  floating?: boolean;
  emptyAction?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const iconColor = useResolveClassNames("text-primary-foreground").color;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !busy;

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || busy) return;
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    onSend(trimmed, attachments);
  }

  async function addAttachments(source: ImageSource) {
    if (busy) return;
    setAttachmentError(null);
    try {
      const picked = await pickImageAttachments(source);
      if (picked.length) setAttachments((current) => [...current, ...picked]);
    } catch {
      setAttachmentError("Could not add images. Try again.");
    }
  }

  return (
    <View
      className={floating ? "" : "border-t border-border/40 bg-background"}
      style={{
        paddingBottom: floating
          ? insets.bottom + 12
          : Math.max(insets.bottom, 8),
      }}
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
              className="rounded-full border border-border bg-card px-3.5 py-1.5 active:bg-accent"
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
            onRemove={(index) =>
              setAttachments((current) => current.filter((_, i) => i !== index))
            }
          />
        </View>
      ) : null}
      {attachmentError ? (
        <Text className="px-4 pt-2 text-destructive" accessibilityRole="alert">
          {attachmentError}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-2 px-4 pt-2">
        <View className="min-h-12 flex-1 flex-row items-end rounded-3xl bg-card pl-1 pr-4">
          {/* Draw the border without adding height to the 48-point input row. */}
          <View
            pointerEvents="none"
            className="absolute inset-0 rounded-3xl border border-border"
          />
          <ImageAttachmentMenu
            onSelect={(source) => void addAttachments(source)}
            disabled={busy}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            multiline
            returnKeyType="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={submit}
            style={{ includeFontPadding: false, textAlignVertical: "center" }}
            className="max-h-32 min-h-12 flex-1 py-3.5 text-base leading-5 text-foreground"
          />
        </View>
        {!text.trim() && !attachments.length && emptyAction ? (
          emptyAction
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityLabel="Send"
            accessibilityRole="button"
            className={cn(
              "size-12 items-center justify-center rounded-full bg-primary",
              !canSend && "opacity-30",
            )}
          >
            <SymbolView
              name={SEND_ICON}
              tintColor={iconColor}
              size={22}
              weight="bold"
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
