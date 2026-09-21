// SwiftUI layer: the universal button variants don't expose Liquid Glass,
// and a floating primary action wants the prominent glass style the system
// uses for its own toolbars (same choice as the setup prototypes).
import { Host } from "@expo/ui";
import { Button, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  font,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { useResolveClassNames } from "uniwind";

import { useColorScheme } from "@/hooks/use-color-scheme";

import { ACTION_HEIGHT, type PrimaryActionProps } from "./primary-action-shared";

export function PrimaryAction({ label, onPress }: PrimaryActionProps) {
  const scheme = useColorScheme();
  const primary = useResolveClassNames("bg-primary").backgroundColor;
  return (
    <Host
      // A fixed frame, not matchContents: measuring the label before the
      // host has its width wraps it letter by letter into a tall sliver
      // for the first frames of the push.
      style={{ height: ACTION_HEIGHT }}
      seedColor={typeof primary === "string" ? primary : undefined}
      colorScheme={scheme === "dark" ? "dark" : "light"}
      ignoreSafeArea="all"
    >
      <Button
        onPress={onPress}
        modifiers={[buttonStyle("glassProminent"), controlSize("large")]}
      >
        {/* The label fills the host, so the capsule does too. */}
        <Text
          modifiers={[
            font({ size: 17, weight: "semibold" }),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
          ]}
        >
          {label}
        </Text>
      </Button>
    </Host>
  );
}
