import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Share, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import {
  AndroidMenuOverlay,
  type AndroidMenuAnchor,
} from "@/components/ui/android-menu-overlay";

const COPY_ICON = { ios: "doc.on.doc", android: "content_copy" } as const;
const SHARE_ICON = { ios: "square.and.arrow.up", android: "share" } as const;

/**
 * Copy/share for a message. Android owns its menu (the @expo/ui drop-in
 * anchors to the whole trigger box and fires a second, untunable
 * long-press), so: one gesture-handler long-press — stationary or it
 * fails — opening a small overlay where the finger is.
 */
export function MessageMenu({ text, children }: { text: string; children: ReactNode }) {
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);
  const openRef = useRef(false);
  if (!text.trim()) return children;

  async function act(action: string) {
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
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={dismiss}
        actions={[
          {
            id: "copy",
            title: "Copy",
            icon: COPY_ICON,
            onSelect: () => void act("copy"),
          },
          {
            id: "share",
            title: "Share...",
            icon: SHARE_ICON,
            onSelect: () => void act("share"),
          },
        ]}
      />
    </>
  );
}
