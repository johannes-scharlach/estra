import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import {
  AndroidMenuOverlay,
  type AndroidMenuAnchor,
} from "@/components/ui/android-menu-overlay";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { MenuPickerProps } from "./menu-picker";

const CHEVRON_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

/** Android: compact row button opening the shared overlay, matching category-menu. */
export function MenuPicker({
  label,
  choices,
  selectedValue,
  onValueChange,
  className,
}: MenuPickerProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedValue}`}
        onPress={(e) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          setAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
        }}
        className={cn(
          "flex-row items-center justify-between gap-2 rounded-xl border border-border px-3 py-2",
          className,
        )}
      >
        <Text className="text-sm font-medium">{selectedValue}</Text>
        <SymbolView name={CHEVRON_ICON} tintColor={mutedColor} size={16} />
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={choices.map((choice) => ({
          id: choice,
          title: choice,
          selected: choice === selectedValue,
          onSelect: () => onValueChange(choice),
        }))}
      />
    </View>
  );
}
