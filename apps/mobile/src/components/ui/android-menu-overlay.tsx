import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  Keyframe,
  useReducedMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type AndroidMenuAnchor = { x: number; y: number };
type SymbolName = ComponentProps<typeof SymbolView>["name"];

export type AndroidMenuAction = {
  id: string;
  title: string;
  icon?: SymbolName;
  destructive?: boolean;
  /** Checkmark suffix, e.g. the shop category picker. */
  selected?: boolean;
  onSelect: () => void;
};

const MENU_MARGIN = 16;
const ROW_MIN_HEIGHT = 48;
const MENU_PADDING_Y = 16;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MENU_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.95 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(120);
// Reduced motion: fewer and gentler, not zero — keep the fade, drop the scale.
const MENU_ENTER_REDUCED = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1, easing: EASE_OUT },
}).duration(120);

const CHECK_ICON = { ios: "checkmark", android: "check" } as const;

/**
 * Android popup menu: small overlay where the finger is, 48px rows with
 * ripple. The caller owns the trigger (long-press, … button) and the
 * anchor; this owns positioning, enter animation, and row styling.
 */
export function AndroidMenuOverlay({
  anchor,
  onDismiss,
  actions,
  menuWidth = 220,
}: {
  anchor: AndroidMenuAnchor | null;
  onDismiss: () => void;
  actions: AndroidMenuAction[];
  menuWidth?: number;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const iconColor = useResolveClassNames("text-muted-foreground").color;
  const destructiveColor = useResolveClassNames("text-destructive").color;

  const left = anchor
    ? Math.min(
        Math.max(anchor.x - menuWidth / 2, MENU_MARGIN),
        windowWidth - menuWidth - MENU_MARGIN,
      )
    : 0;
  // Below the finger when there is room, above it when there isn't.
  const estimatedHeight = actions.length * ROW_MIN_HEIGHT + MENU_PADDING_Y;
  const below = anchor
    ? anchor.y + 12 + estimatedHeight <= windowHeight - MENU_MARGIN
    : true;

  return (
    <Modal visible={anchor !== null} transparent onRequestClose={onDismiss}>
      <Pressable className="flex-1" onPress={onDismiss}>
        {anchor ? (
          <Animated.View
            entering={reduced ? MENU_ENTER_REDUCED : MENU_ENTER}
            style={{
              position: "absolute",
              width: menuWidth,
              left,
              top: below ? anchor.y + 12 : undefined,
              bottom: below ? undefined : windowHeight - anchor.y + 12,
            }}
          >
            <View
              className="rounded bg-popover py-2"
              style={{
                elevation: 3,
                maxHeight: windowHeight - MENU_MARGIN * 2 - 24,
              }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
              {actions.map((action) => (
                <Pressable
                  key={action.id}
                  accessibilityRole="menuitem"
                  android_ripple={{ borderless: false }}
                  onPress={() => {
                    onDismiss();
                    action.onSelect();
                  }}
                  className="min-h-[48px] flex-row items-center gap-3 px-3"
                >
                  {action.icon ? (
                    <SymbolView
                      name={action.icon}
                      tintColor={
                        action.destructive ? destructiveColor : iconColor
                      }
                      size={20}
                    />
                  ) : null}
                  <Text
                    className={cn(
                      "flex-1 text-sm",
                      action.destructive && "text-destructive",
                    )}
                  >
                    {action.title}
                  </Text>
                  {action.selected ? (
                    <SymbolView
                      name={CHECK_ICON}
                      tintColor={iconColor}
                      size={16}
                    />
                  ) : null}
                </Pressable>
              ))}
              </ScrollView>
            </View>
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}
