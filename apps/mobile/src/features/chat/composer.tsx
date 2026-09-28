import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
  type DerivedValue,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
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
const CHAT_ICON = {
  ios: "bubble.left",
  android: "chat_bubble_outline",
} as const;

const CONTEXT_SPRING = {
  duration: 400,
  dampingRatio: 1,
  overshootClamping: true,
};

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

/** Two fixed rounded ends and a stretching centre. Every frame changes only
 * transforms/opacity, so the scroll and the bar do not compete for layout. */
function ComposerBackground({
  width,
  barWidth,
  colorClassName,
  right = false,
  opacity,
}: {
  width: DerivedValue<number>;
  barWidth: SharedValue<number>;
  colorClassName: string;
  right?: boolean;
  opacity?: SharedValue<number>;
}) {
  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: right
          ? Math.max(104, barWidth.get() - 32) - width.get()
          : 0,
      },
    ],
    opacity: opacity?.get() ?? 1,
  }));
  const endStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, width.get() - 48) }],
  }));
  const centreStyle = useAnimatedStyle(() => {
    const span = Math.max(0, width.get() - 48);
    // Scale down a full-width fill. Enlarging a one-point strip also enlarges
    // Android's pixel rounding, leaving visible gaps beside the rounded ends.
    const fullSpan = Math.max(1, barWidth.get() - 32 - 48);
    return {
      transform: [
        { translateX: (span - fullSpan) / 2 },
        { scaleX: span / fullSpan },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute bottom-0 left-4 right-4 top-2"
      style={positionStyle}
    >
      <View
        className={cn(
          "absolute bottom-0 left-0 top-0 w-12 rounded-3xl",
          colorClassName,
        )}
      />
      <Animated.View
        className={cn(
          "absolute bottom-0 left-0 top-0 w-12 rounded-3xl",
          colorClassName,
        )}
        style={endStyle}
      />
      <Animated.View
        className={cn("absolute bottom-0 left-6 right-6 top-0", colorClassName)}
        style={centreStyle}
      />
    </Animated.View>
  );
}

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
  collapsedAction,
  preferCollapsed = false,
}: {
  placeholder: string;
  busy: boolean;
  suggestions: string[];
  onSend: (text: string, attachments: ImageAttachment[]) => void;
  floating?: boolean;
  emptyAction?: ReactNode;
  /** Wide version of emptyAction. Both actions use the background drawn here. */
  collapsedAction?: ReactNode;
  /** A suggestion only: focus or starting a draft keeps the field expanded. */
  preferCollapsed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  // A draft claims the space until Send, even if it is subsequently emptied.
  const [draftStarted, setDraftStarted] = useState(false);
  const [pickingImages, setPickingImages] = useState(false);
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !busy;
  const showEmptyAction =
    !focused && !text.trim() && !attachments.length && !!emptyAction;
  const collapsed =
    preferCollapsed &&
    !!collapsedAction &&
    !focused &&
    !draftStarted &&
    !pickingImages &&
    !attachmentError;
  const reduced = useReducedMotion();
  const swapIn = reduced ? SWAP_IN_REDUCED : SWAP_IN;
  const swapOut = reduced ? SWAP_OUT_REDUCED : SWAP_OUT;
  const expansion = useSharedValue(collapsed ? 0 : 1);
  const reducedFade = useSharedValue(collapsed ? 0 : 1);
  const iconMix = useSharedValue(collapsed ? 0 : 1);
  const actionPresence = useSharedValue(showEmptyAction ? 1 : 0);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    expansion.set(
      reduced
        ? collapsed
          ? 0
          : 1
        : withSpring(collapsed ? 0 : 1, CONTEXT_SPRING),
    );
    if (reduced) {
      reducedFade.set(
        withTiming(collapsed ? 0 : 1, {
          duration: 150,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        }),
      );
    }
  }, [collapsed, expansion, reduced, reducedFade]);

  // One stationary icon slot, with complementary opacity. Tying each glyph
  // to a different part of the spring left a dim gap that read as a flicker.
  useEffect(() => {
    iconMix.set(
      withTiming(collapsed ? 0 : 1, {
        duration: 200,
        easing: EASE_IN_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [collapsed, iconMix]);

  const chatIconStyle = useAnimatedStyle(() => ({ opacity: 1 - iconMix.get() }));
  const cameraIconStyle = useAnimatedStyle(() => ({ opacity: iconMix.get() }));

  useEffect(() => {
    actionPresence.set(
      withTiming(showEmptyAction ? 1 : 0, {
        duration: 200,
        easing: EASE_IN_OUT,
      }),
    );
  }, [actionPresence, showEmptyAction]);

  // Widths are geometry for the background transforms, never layout styles.
  const fieldWidth = useDerivedValue(() => {
    const available = Math.max(104, barWidth.get() - 32);
    return interpolate(
      expansion.get(),
      [0, 1],
      [48, available - 56 * actionPresence.get()],
    );
  });
  const actionWidth = useDerivedValue(() =>
    interpolate(
      expansion.get(),
      [0, 1],
      [Math.max(48, barWidth.get() - 32 - 56), 48],
    ),
  );
  const collapsedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reduced ? reducedFade.get() : expansion.get(),
      [0, 0.5],
      [1, 0],
      "clamp",
    ),
  }));
  const wideActionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduced
          ? 0
          : (Math.max(0, barWidth.get() - 32 - 104) * expansion.get()) / 2,
      },
    ],
  }));
  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reduced ? reducedFade.get() : expansion.get(),
      [0.35, 1],
      [0, 1],
      "clamp",
    ),
  }));

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || busy) return;
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    setDraftStarted(false);
    onSend(trimmed, attachments);
  }

  async function addAttachments(source: ImageSource) {
    if (busy) return;
    setAttachmentError(null);
    setPickingImages(true);
    try {
      const picked = await pickImageAttachments(source);
      if (picked.length) {
        setDraftStarted(true);
        setAttachments((current) => [...current, ...picked]);
      }
    } catch {
      setAttachmentError("Could not add images. Try again.");
    } finally {
      setPickingImages(false);
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
      {/* Both layouts stay mounted. Hiding the field must never discard its
          text, selection, attachments, or an image picker still in flight.
          Only the active row takes space or participates in accessibility. */}
      <View onLayout={(event) => barWidth.set(event.nativeEvent.layout.width)}>
        {collapsedAction ? (
          <>
            <ComposerBackground
              width={fieldWidth}
              barWidth={barWidth}
              colorClassName="bg-muted"
            />
            <ComposerBackground
              right
              width={actionWidth}
              barWidth={barWidth}
              colorClassName="bg-primary"
              opacity={actionPresence}
            />
          </>
        ) : null}
        {collapsedAction ? (
          <Animated.View
            pointerEvents={collapsed ? "auto" : "none"}
            accessibilityElementsHidden={!collapsed}
            importantForAccessibility={
              collapsed ? "auto" : "no-hide-descendants"
            }
            style={{
              position: collapsed ? "relative" : "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
            className="flex-row items-end gap-2 px-4 pt-2"
          >
            <Animated.View style={chatIconStyle}>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                accessibilityRole="button"
                accessibilityLabel={placeholder}
                className="size-12 items-center justify-center rounded-full active:opacity-60"
              >
                <SymbolView
                  name={CHAT_ICON}
                  tintColor={placeholderColor}
                  size={22}
                />
              </Pressable>
            </Animated.View>
            <Animated.View
              className="flex-1"
              style={[collapsedContentStyle, wideActionStyle]}
            >
              {collapsedAction}
            </Animated.View>
          </Animated.View>
        ) : null}
        <Animated.View
          pointerEvents={collapsed ? "none" : "auto"}
          accessibilityElementsHidden={collapsed}
          importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
          style={{
            position: collapsed ? "absolute" : "relative",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* No swap animation when the composer first appears. */}
          <LayoutAnimationConfig skipEntering>
            <View className="flex-row items-end gap-2 px-4 pt-2">
              <Animated.View
                layout={reduced || collapsed ? undefined : FIELD_LAYOUT}
                className={cn(
                  "min-h-12 flex-1 flex-row items-end rounded-3xl",
                  !collapsedAction && "bg-muted pl-1",
                  showEmptyAction ? "pr-4" : "pr-1",
                )}
              >
                <Animated.View style={cameraIconStyle}>
                  <ImageAttachmentMenu
                    onSelect={(source) => void addAttachments(source)}
                    disabled={busy}
                  />
                </Animated.View>
                <Animated.View
                  className="flex-1 flex-row items-end"
                  style={expandedContentStyle}
                >
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={(value) => {
                      setText(value);
                      if (value.length) setDraftStarted(true);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderColor}
                    multiline
                    returnKeyType="send"
                    submitBehavior="blurAndSubmit"
                    onSubmitEditing={submit}
                    style={{
                      includeFontPadding: false,
                      textAlignVertical: "center",
                    }}
                    className="max-h-32 min-h-12 flex-1 py-3.5 text-base leading-5 text-foreground"
                  />
                  {/* Send sits inside the field; emptyAction replaces it outside while idle. */}
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
              </Animated.View>
              {showEmptyAction ? (
                <Animated.View entering={swapIn} exiting={swapOut}>
                  <Animated.View style={expandedContentStyle}>
                    {emptyAction}
                  </Animated.View>
                </Animated.View>
              ) : null}
            </View>
          </LayoutAnimationConfig>
        </Animated.View>
      </View>
    </View>
  );
}
