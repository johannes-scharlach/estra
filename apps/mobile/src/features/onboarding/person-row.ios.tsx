import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import type { PersonRowProps } from "./person-row";

/** iOS: tap the row to edit; swipe left reveals Remove. */
export function PersonRow({ name, detail, onEdit, onRemove }: PersonRowProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const swipeable = useRef<SwipeableMethods>(null);

  return (
    <Swipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          className="w-24 items-center justify-center bg-destructive"
          onPress={() => {
            swipeable.current?.close();
            onRemove();
          }}
        >
          <Text className="font-medium text-destructive-foreground">
            Remove
          </Text>
        </Pressable>
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${name}`}
        className="min-h-16 flex-row items-center gap-3 bg-card px-4 py-3 active:bg-accent"
        onPress={onEdit}
      >
        <View className="flex-1 gap-1">
          <Text className="text-[17px] font-medium">{name}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {detail}
          </Text>
        </View>
        <SymbolView name="chevron.right" size={16} tintColor={mutedColor} />
      </Pressable>
    </Swipeable>
  );
}
