import { MenuView } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import type { MealCardMenuProps } from "./meal-card-menu";

const MENU_ICON = {
  ios: "ellipsis",
  android: "more_horiz",
} as const;

/** iOS: native menu. The card itself stays in meal-section.tsx. */
export function MealCardMenu({
  recipeId,
  recipeName,
  eatersLabel,
  onEditEaters,
  onChange,
  onMove,
  onSkip,
}: MealCardMenuProps) {
  const muted = useResolveClassNames("text-muted-foreground").color;

  return (
    <MenuView
      key={recipeId}
      style={{ position: "absolute", right: 6, top: 6 }}
      actions={[
        {
          id: "eaters",
          title: eatersLabel,
          image: "person.2",
        },
        {
          id: "change",
          title: "Choose another meal",
          image: "arrow.triangle.2.circlepath",
        },
        {
          id: "move",
          title: "Move to…",
          image: "arrow.right",
        },
        {
          id: "remove-section",
          title: "",
          displayInline: true,
          subactions: [
            {
              id: "remove",
              title: "Remove from plan",
              image: "calendar.badge.minus",
              attributes: { destructive: true },
            },
          ],
        },
      ]}
      onPressAction={({ nativeEvent: { event } }) => {
        if (event === "eaters") onEditEaters();
        else if (event === "change") onChange();
        else if (event === "move") onMove();
        else if (event === "remove") onSkip();
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${recipeName}`}
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-card/80">
          <SymbolView name={MENU_ICON} tintColor={muted} size={16} />
        </View>
      </View>
    </MenuView>
  );
}
