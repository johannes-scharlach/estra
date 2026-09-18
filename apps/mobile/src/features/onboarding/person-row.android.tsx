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

import type { PersonRowProps } from "./person-row";

const MENU_ICON = { ios: "ellipsis", android: "more_horiz" } as const;
const EDIT_ICON = { ios: "pencil", android: "edit" } as const;
const REMOVE_ICON = { ios: "trash", android: "delete" } as const;

/** Android: tap the row to edit; trailing … opens Edit/Remove. */
export function PersonRow({ name, detail, onEdit, onRemove }: PersonRowProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${name}`}
        className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
        onPress={onEdit}
      >
        <View className="flex-1 gap-1">
          <Text className="text-[17px] font-medium">{name}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {detail}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${name}`}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
          onPress={(e) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            setAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
          }}
        >
          <SymbolView name={MENU_ICON} tintColor={mutedColor} size={20} />
        </Pressable>
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={[
          { id: "edit", title: "Edit", icon: EDIT_ICON, onSelect: onEdit },
          {
            id: "remove",
            title: "Remove",
            icon: REMOVE_ICON,
            destructive: true,
            onSelect: onRemove,
          },
        ]}
      />
    </View>
  );
}
