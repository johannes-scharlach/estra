import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import type { CategoryMenuProps } from "./category-menu";

const CHEVRON_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

/** iOS: native menu with checkmark state. */
export function CategoryMenu({
  categories,
  categoryId,
  categoryName,
  onSelect,
}: CategoryMenuProps) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  return (
    <MenuView
      onPressAction={({ nativeEvent: { event } }) => {
        onSelect(event === "uncategorised" ? null : event);
      }}
      actions={[
        {
          id: "uncategorised",
          title: "Uncategorised",
          state: (!categoryId ? "on" : "off") as MenuAction["state"],
        },
        ...categories.map((cat) => ({
          id: cat.id,
          title: cat.name,
          state: (categoryId === cat.id ? "on" : "off") as MenuAction["state"],
        })),
      ]}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Category: ${categoryName ?? "Uncategorised"}`}
        className="flex-row items-center justify-between rounded-xl border border-border px-4 py-3"
      >
        <Text className="text-sm font-medium">
          {categoryName ?? "Uncategorised"}
        </Text>
        <SymbolView
          name={CHEVRON_ICON}
          tintColor={mutedColor}
          size={16}
        />
      </View>
    </MenuView>
  );
}
