import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useResolveClassNames } from "uniwind";

export type CloseButtonProps = { onPress: () => void; disabled?: boolean };

export function CloseButton({ onPress, disabled }: CloseButtonProps) {
  const foreground = useResolveClassNames("text-foreground").color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      disabled={disabled}
      onPress={onPress}
      className="size-11 items-center justify-center rounded-full bg-muted disabled:opacity-50"
    >
      <SymbolView
        name={{ ios: "xmark", android: "close" }}
        size={20}
        tintColor={foreground}
      />
    </Pressable>
  );
}
