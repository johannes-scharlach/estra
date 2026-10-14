import { Host, RNHostView } from "@expo/ui";
import { Column, ModalBottomSheet } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import { type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";

export function EditorSheet({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Host style={{ position: "absolute" }} pointerEvents="none">
      {/* The universal height snap point allows a half-height state that hides
          form actions. Expand to the content's height, not the full screen. */}
      <ModalBottomSheet
        onDismissRequest={onDismiss}
        skipPartiallyExpanded
        showDragHandle
      >
        <Column modifiers={[padding(24, 12, 24, Math.max(insets.bottom, 16))]}>
          <RNHostView matchContents>
            <View
              style={{ width: Math.min(width - 48, 540) }}
              className="gap-5"
            >
              <View className="flex-row items-center justify-between gap-4">
                <Text
                  accessibilityRole="header"
                  className="flex-1 text-xl font-semibold"
                >
                  {title}
                </Text>
                <CloseButton onPress={onDismiss} />
              </View>
              {children}
            </View>
          </RNHostView>
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}
