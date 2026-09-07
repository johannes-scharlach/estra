import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import type { ImageAttachment } from "./image-attachment";

const REMOVE_ICON = { ios: "xmark", android: "close", web: "close" } as const;

export function ImageAttachmentStrip({
  attachments,
  onRemove,
  size = 72,
}: {
  attachments: ImageAttachment[];
  onRemove: (index: number) => void;
  size?: number;
}) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  if (!attachments.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-2 py-2"
    >
      {attachments.map((attachment, index) => (
        <View key={`${attachment.uri}-${index}`}>
          <Image
            source={{ uri: attachment.uri }}
            accessibilityLabel={`Attached image ${index + 1}`}
            contentFit="cover"
            style={{ width: size, height: size, borderRadius: 12 }}
          />
          <Pressable
            onPress={() => onRemove(index)}
            hitSlop={8}
            accessibilityLabel={`Remove attached image ${index + 1}`}
            accessibilityRole="button"
            className="absolute -right-2 -top-2 size-6 items-center justify-center rounded-full bg-muted"
          >
            <SymbolView name={REMOVE_ICON} tintColor={mutedColor} size={11} weight="bold" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
