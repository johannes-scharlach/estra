import { MenuView, type MenuComponentRef } from "@expo/ui/community/menu";
import * as Clipboard from "expo-clipboard";
import { useRef, type ReactNode } from "react";
import { Alert, Platform, Share, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export function MessageMenu({ text, children }: { text: string; children: ReactNode }) {
  const menuRef = useRef<MenuComponentRef>(null);
  if (!text.trim()) return children;

  async function act(action: string) {
    try {
      if (action === "copy") await Clipboard.setStringAsync(text);
      if (action === "share") await Share.share({ message: text });
    } catch {
      Alert.alert("Couldn't " + (action === "copy" ? "copy" : "share") + " message", "Please try again.");
    }
  }

  const menu = (
    <MenuView
      ref={menuRef}
      shouldOpenOnLongPress
      actions={[
        { id: "copy", title: "Copy", image: "doc.on.doc" },
        { id: "share", title: "Share...", image: "square.and.arrow.up" },
      ]}
      onPressAction={({ nativeEvent }) => void act(nativeEvent.event)}
    >
      {children}
    </MenuView>
  );

  if (Platform.OS !== "android") return menu;

  // Observe native touches too: nested cards and markdown own RN's responder.
  const longPress = Gesture.LongPress()
    .runOnJS(true)
    // eslint-disable-next-line react-hooks/refs -- onStart registers an event handler; it does not call it during render.
    .onStart(() => menuRef.current?.show());
  return (
    <GestureDetector gesture={longPress}>
      <View collapsable={false}>{menu}</View>
    </GestureDetector>
  );
}
