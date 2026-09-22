import { Host } from "@expo/ui";
import { Button } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useResolveClassNames } from "uniwind";

import type { CloseButtonProps } from "./close-button";

export function CloseButton({
  onPress,
  disabled: isDisabled = false,
}: CloseButtonProps) {
  const foreground = useResolveClassNames("text-foreground").color;
  return (
    <Host
      style={{ width: 44, height: 44 }}
      seedColor={foreground}
      ignoreSafeArea="all"
    >
      <Button
        label="Close"
        systemImage="xmark"
        onPress={onPress}
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          controlSize("large"),
          labelStyle("iconOnly"),
          disabled(isDisabled),
          frame({ width: 44, height: 44 }),
        ]}
      />
    </Host>
  );
}
