import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Share,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Keyframe,
  useReducedMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

const MENU_WIDTH = 220;
const MENU_MARGIN = 16;

// Module scope — layout-animation builders live outside the component.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MENU_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.95 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(120);
// Reduced motion: fewer and gentler, not zero — keep the fade, drop the scale.
const MENU_ENTER_REDUCED = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1, easing: EASE_OUT },
}).duration(120);

const COPY_ICON = { ios: "doc.on.doc", android: "content_copy" } as const;
const SHARE_ICON = { ios: "square.and.arrow.up", android: "share" } as const;

type Anchor = { x: number; y: number };

/**
 * Copy/share for a message. Android owns its menu (the @expo/ui drop-in
 * anchors to the whole trigger box and fires a second, untunable
 * long-press), so: one gesture-handler long-press — stationary or it
 * fails — opening a small overlay where the finger is.
 */
export function MessageMenu({ text, children }: { text: string; children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const iconColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openRef = useRef(false);
  if (!text.trim()) return children;

  async function act(action: string) {
    setAnchor(null);
    openRef.current = false;
    try {
      if (action === "copy") await Clipboard.setStringAsync(text);
      if (action === "share") await Share.share({ message: text });
    } catch {
      Alert.alert("Couldn't " + (action === "copy" ? "copy" : "share") + " message", "Please try again.");
    }
  }

  function dismiss() {
    setAnchor(null);
    openRef.current = false;
  }

  const longPress = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(500)
    .maxDistance(10)
    // eslint-disable-next-line react-hooks/refs -- onStart registers an event handler; it does not call it during render.
    .onStart((e) => {
      if (openRef.current) return;
      openRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setAnchor({ x: e.absoluteX, y: e.absoluteY });
    });

  // Below the finger when there is room, above it when there isn't.
  const left = anchor
    ? Math.min(Math.max(anchor.x - MENU_WIDTH / 2, MENU_MARGIN), windowWidth - MENU_WIDTH - MENU_MARGIN)
    : 0;
  const below = anchor ? anchor.y + 12 + 112 <= windowHeight - MENU_MARGIN : true;

  return (
    <>
      <GestureDetector gesture={longPress}>
        <View
          collapsable={false}
          className={anchor ? "bg-accent/60" : undefined}
        >
          {children}
        </View>
      </GestureDetector>
      <Modal visible={anchor !== null} transparent onRequestClose={dismiss}>
        <Pressable className="flex-1" onPress={dismiss}>
          {anchor ? (
            <Animated.View
              entering={reduced ? MENU_ENTER_REDUCED : MENU_ENTER}
              style={{
                position: "absolute",
                width: MENU_WIDTH,
                left,
                top: below ? anchor.y + 12 : undefined,
                bottom: below ? undefined : windowHeight - anchor.y + 12,
              }}
            >
              <View className="rounded bg-popover py-2" style={{ elevation: 3 }}>
                <Pressable
                  accessibilityRole="menuitem"
                  android_ripple={{ borderless: false }}
                  onPress={() => void act("copy")}
                  className="min-h-[48px] flex-row items-center gap-3 px-3"
                >
                  <SymbolView name={COPY_ICON} tintColor={iconColor} size={20} />
                  <Text className="text-sm">Copy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="menuitem"
                  android_ripple={{ borderless: false }}
                  onPress={() => void act("share")}
                  className="min-h-[48px] flex-row items-center gap-3 px-3"
                >
                  <SymbolView name={SHARE_ICON} tintColor={iconColor} size={20} />
                  <Text className="text-sm">Share...</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
