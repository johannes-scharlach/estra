import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import {
  AndroidMenuOverlay,
  type AndroidMenuAnchor,
} from "@/components/ui/android-menu-overlay";

import type { MealCardMenuProps } from "./meal-card-menu";

const MENU_ICON = {
  ios: "ellipsis",
  android: "more_horiz",
} as const;
const EATERS_ICON = { ios: "person.2", android: "group" } as const;
const CHANGE_ICON = {
  ios: "arrow.triangle.2.circlepath",
  android: "autorenew",
} as const;
const MOVE_ICON = { ios: "arrow.right", android: "arrow_forward" } as const;
const REMOVE_ICON = {
  ios: "calendar.badge.minus",
  android: "delete",
} as const;

/** Android: … button opening the shared overlay where the finger is. */
export function MealCardMenu({
  recipeName,
  eatersLabel,
  onEditEaters,
  onChange,
  onMove,
  onSkip,
}: MealCardMenuProps) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  return (
    <View style={{ position: "absolute", right: 6, top: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${recipeName}`}
        onPress={(e) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          setAnchor({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
        }}
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
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={[
          {
            id: "eaters",
            title: eatersLabel,
            icon: EATERS_ICON,
            onSelect: onEditEaters,
          },
          {
            id: "change",
            title: "Choose another meal",
            icon: CHANGE_ICON,
            onSelect: onChange,
          },
          {
            id: "move",
            title: "Move to…",
            icon: MOVE_ICON,
            onSelect: onMove,
          },
          {
            id: "remove",
            title: "Remove from plan",
            icon: REMOVE_ICON,
            destructive: true,
            onSelect: onSkip,
          },
        ]}
      />
    </View>
  );
}
