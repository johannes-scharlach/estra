import { MenuView } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ImageSource } from "./image-attachment";

const CAMERA_ICON = { ios: "camera", android: "photo_camera" } as const;

export function ImageAttachmentMenu({
  onSelect,
  disabled = false,
  label,
  accessibilityLabel = "Add images",
}: {
  onSelect: (source: ImageSource) => void;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
}) {
  const iconColor = useResolveClassNames("text-muted-foreground").color;

  return (
    <View pointerEvents={disabled ? "none" : "auto"} className={disabled ? "opacity-40" : undefined}>
      <MenuView
        actions={[
          { id: "camera", title: "Take photo", attributes: { disabled } },
          { id: "library", title: "Choose from library", attributes: { disabled } },
        ]}
        onPressAction={({ nativeEvent: { event } }) => {
          if (!disabled && (event === "camera" || event === "library")) onSelect(event);
        }}
      >
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={label ?? accessibilityLabel}
          accessibilityState={{ disabled }}
          className={cn(
            "min-h-12 flex-row items-center justify-center gap-2",
            label ? "px-2" : "w-12",
          )}
        >
          <SymbolView name={CAMERA_ICON} tintColor={iconColor} size={22} />
          {label ? <Text variant="muted">{label}</Text> : null}
        </View>
      </MenuView>
    </View>
  );
}
