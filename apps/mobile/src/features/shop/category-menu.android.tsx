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

import type { CategoryMenuProps } from "./category-menu";
import { sentenceCase } from "./text";

const CHEVRON_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

/** Android: row button opening the shared overlay, checkmark on selected. */
export function CategoryMenu({
  categories,
  categoryId,
  categoryName,
  onSelect,
}: CategoryMenuProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Category: ${categoryName ?? "Uncategorised"}`}
        onPress={(e) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          setAnchor({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
        }}
        className="min-h-12 flex-row items-center gap-2 px-4 py-3 active:bg-accent"
      >
        <Text className="flex-1 text-base">Category</Text>
        <Text variant="muted" className="text-base">
          {sentenceCase(categoryName ?? "Uncategorised")}
        </Text>
        <SymbolView name={CHEVRON_ICON} tintColor={mutedColor} size={16} />
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={[
          {
            id: "uncategorised",
            title: "Uncategorised",
            selected: !categoryId,
            onSelect: () => onSelect(null),
          },
          ...categories.map((cat) => ({
            id: cat.id,
            title: sentenceCase(cat.name),
            selected: categoryId === cat.id,
            onSelect: () => onSelect(cat.id),
          })),
        ]}
      />
    </View>
  );
}
