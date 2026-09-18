import { Platform, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

// The "+" sits leading on Android, next to the checkbox column above it;
// trailing on iOS, matching its checkmark-on-the-right convention.
export function AddRow({
  label,
  onPress,
  bordered = true,
}: {
  label: string;
  onPress: () => void;
  bordered?: boolean;
}) {
  const plus = <Text className="text-2xl text-primary">+</Text>;
  const text = <Text className="flex-1 font-medium text-primary">{label}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      className={
        bordered
          ? "min-h-14 flex-row items-center justify-between gap-4 border-t border-border px-4 py-3"
          : "min-h-14 flex-row items-center justify-between gap-4 px-4 py-3"
      }
      onPress={onPress}
    >
      {Platform.OS === "android" ? (
        <>
          {plus}
          {text}
        </>
      ) : (
        <>
          {text}
          {plus}
        </>
      )}
    </Pressable>
  );
}
