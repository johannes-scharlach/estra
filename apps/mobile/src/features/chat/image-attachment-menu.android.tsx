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

import type { ImageSource } from "./image-attachment";
import type { ImageAttachmentMenuProps } from "./image-attachment-menu";

const CAMERA_ICON = { ios: "camera", android: "photo_camera" } as const;
const TAKE_PHOTO_ICON = { ios: "camera", android: "photo_camera" } as const;
const LIBRARY_ICON = {
  ios: "photo.on.rectangle",
  android: "photo_library",
} as const;

/** Android: camera button opening the shared overlay where the finger is. */
export function ImageAttachmentMenu({
  onSelect,
  disabled = false,
  label,
  accessibilityLabel = "Add images",
}: ImageAttachmentMenuProps) {
  const iconColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  function select(source: ImageSource) {
    if (!disabled) onSelect(source);
  }

  return (
    <View pointerEvents={disabled ? "none" : "auto"} className={disabled ? "opacity-40" : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? accessibilityLabel}
        accessibilityState={{ disabled }}
        onPress={(e) => {
          if (disabled) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          setAnchor({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
        }}
        className={cn(
          "min-h-12 flex-row items-center justify-center gap-2",
          label ? "px-2" : "w-12",
        )}
      >
        <SymbolView name={CAMERA_ICON} tintColor={iconColor} size={22} />
        {label ? <Text variant="muted">{label}</Text> : null}
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={[
          {
            id: "camera",
            title: "Take photo",
            icon: TAKE_PHOTO_ICON,
            onSelect: () => select("camera"),
          },
          {
            id: "library",
            title: "Choose from library",
            icon: LIBRARY_ICON,
            onSelect: () => select("library"),
          },
        ]}
      />
    </View>
  );
}
