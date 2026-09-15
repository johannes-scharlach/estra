import { Host } from "@expo/ui";
import { Button, ContextMenu, RNHostView } from "@expo/ui/swift-ui";
import * as Clipboard from "expo-clipboard";
import type { ReactNode } from "react";
import { Alert, Share, useWindowDimensions, View } from "react-native";

export function MessageMenu({ text, children }: { text: string; children: ReactNode }) {
  const { width: windowWidth } = useWindowDimensions();
  if (!text.trim()) return children;

  async function act(action: string) {
    try {
      if (action === "copy") await Clipboard.setStringAsync(text);
      if (action === "share") await Share.share({ message: text });
    } catch {
      Alert.alert("Couldn't " + (action === "copy" ? "copy" : "share") + " message", "Please try again.");
    }
  }

  return (
    <Host matchContents>
      <ContextMenu>
        <ContextMenu.Trigger>
          <RNHostView matchContents>
            <>{children}</>
          </RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Preview>
          <RNHostView matchContents>
            <View
              className="overflow-hidden rounded-2xl bg-background px-4 py-3"
              style={{ width: windowWidth - 48, maxHeight: 340 }}
            >
              {children}
            </View>
          </RNHostView>
        </ContextMenu.Preview>
        <ContextMenu.Items>
          <Button label="Copy" systemImage="doc.on.doc" onPress={() => void act("copy")} />
          <Button
            label="Share..."
            systemImage="square.and.arrow.up"
            onPress={() => void act("share")}
          />
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}
