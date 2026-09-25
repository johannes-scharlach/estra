import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
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
  ios: "arrow.up.circle.fill",
  android: "arrow_circle_up",
} as const;

// Focusing hands the trailing slot from emptyAction to Send, and blurring an
// empty field hands it back. The outgoing button leaves first, the field
// follows a beat later, and the incoming button lands as the field settles.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const FIELD_LAYOUT = LinearTransition.duration(200)
  .delay(50)
  .easing(EASE_IN_OUT);
const SWAP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.8 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(150)
  .delay(170);
const SWAP_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.8 }], easing: EASE_OUT },
}).duration(150);
// Reduced motion: keep the fade that explains the swap, drop scale and reflow.
const SWAP_IN_REDUCED = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1, easing: EASE_OUT },
})
  .duration(150)
  .delay(170)
  .reduceMotion(ReduceMotion.Never);
const SWAP_OUT_REDUCED = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0, easing: EASE_OUT },
})
  .duration(150)
  .reduceMotion(ReduceMotion.Never);

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
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !busy;
  const showEmptyAction =
    !focused && !text.trim() && !attachments.length && !!emptyAction;
  const reduced = useReducedMotion();
  const swapIn = reduced ? SWAP_IN_REDUCED : SWAP_IN;
  const swapOut = reduced ? SWAP_OUT_REDUCED : SWAP_OUT;

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
              className="rounded-full bg-muted px-3.5 py-1.5 active:bg-accent"
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
      {/* No swap animation when the composer first appears. */}
      <LayoutAnimationConfig skipEntering>
        <View className="flex-row items-end gap-2 px-4 pt-2">
          <Animated.View
            layout={FIELD_LAYOUT}
            className={cn(
              "min-h-12 flex-1 flex-row items-end rounded-3xl bg-muted pl-1",
              showEmptyAction ? "pr-4" : "pr-1",
            )}
          >
            <ImageAttachmentMenu
              onSelect={(source) => void addAttachments(source)}
              disabled={busy}
            />
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              returnKeyType="send"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={submit}
              style={{ includeFontPadding: false, textAlignVertical: "center" }}
              className="max-h-32 min-h-12 flex-1 py-3.5 text-base leading-5 text-foreground"
            />
            {/* Send sits inside the field, like Home's; emptyAction replaces it outside while the field is idle. */}
            {showEmptyAction ? null : (
              <Animated.View entering={swapIn} exiting={swapOut}>
                <Pressable
                  onPress={submit}
                  disabled={!canSend}
                  accessibilityLabel="Send"
                  accessibilityRole="button"
                  hitSlop={{ right: 4 }}
                  className="h-12 w-10 items-center justify-center active:opacity-60"
                  style={canSend ? undefined : { opacity: 0.35 }}
                >
                  <SymbolView
                    name={SEND_ICON}
                    tintColor={canSend ? primaryColor : placeholderColor}
                    size={26}
                  />
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
          {showEmptyAction ? (
            <Animated.View entering={swapIn} exiting={swapOut}>
              {emptyAction}
            </Animated.View>
          ) : null}
        </View>
      </LayoutAnimationConfig>
    </View>
  );
}
