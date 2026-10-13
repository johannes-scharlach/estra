import { BottomSheet } from "@expo/ui";
import { useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";

/** Native sheet fitted tightly to content with glassmorphism background. */
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
  const bottomInset = Math.max(insets.bottom, 16);
  const [contentHeight, setContentHeight] = useState<number>(240);

  return (
    <BottomSheet
      isPresented
      onDismiss={onDismiss}
      showDragIndicator
      snapPoints={[{ height: Math.round(contentHeight) }]}
      contentPadding={{ top: 12, bottom: bottomInset, left: 24, right: 24 }}
    >
      <View
        style={{ width: Math.min(width - 48, 540) }}
        className="gap-5"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          const target = h + 12 + bottomInset + 16;
          if (h > 40 && Math.abs(contentHeight - target) > 4) {
            setContentHeight(target);
          }
        }}
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
    </BottomSheet>
  );
}
