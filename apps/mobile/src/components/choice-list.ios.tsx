import { SymbolView } from "expo-symbols";
import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";

export type Choice = {
  key: string;
  title: string;
  detail?: string;
};

export function ChoiceList({
  choices,
  selectedKeys,
  selection = "multiple",
  onSelect,
  children,
}: {
  choices: readonly Choice[];
  selectedKeys: readonly string[];
  selection?: "single" | "multiple";
  onSelect: (key: string) => void;
  children?: ReactNode;
}) {
  const primary = useResolveClassNames("bg-primary").backgroundColor;
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {choices.map((choice, index) => {
        const selected = selectedKeys.includes(choice.key);
        return (
          <Pressable
            key={choice.key}
            accessibilityRole={selection === "single" ? "radio" : "checkbox"}
            accessibilityState={{ selected }}
            className={
              index
                ? "min-h-14 flex-row items-center gap-4 border-t border-border px-4 py-3 active:bg-accent"
                : "min-h-14 flex-row items-center gap-4 px-4 py-3 active:bg-accent"
            }
            onPress={() => onSelect(choice.key)}
          >
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">{choice.title}</Text>
              {choice.detail ? (
                <Text className="text-sm leading-5 text-muted-foreground">
                  {choice.detail}
                </Text>
              ) : null}
            </View>
            {selection === "single" ? (
              selected ? <SymbolView name="checkmark" size={18} tintColor={primary} /> : null
            ) : (
              <SymbolView
                name={selected ? "checkmark.circle.fill" : "circle"}
                size={21}
                tintColor={selected ? primary : muted}
              />
            )}
          </Pressable>
        );
      })}
      {children ? <View className="border-t border-border">{children}</View> : null}
    </View>
  );
}
