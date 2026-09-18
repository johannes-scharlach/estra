import { Host } from "@expo/ui";
import { useResolveClassNames } from "uniwind";
import { Button } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  frame,
  glassEffect,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import type { PreviousQuestionButtonProps } from "@/features/onboarding/previous-question-button";

// Universal Button doesn't expose a system-image label or Liquid Glass style.
// Match variant Q: a 44-point native button with clear, interactive glass.
export function PreviousQuestionButton({
  onPress,
  disabled: isDisabled,
}: PreviousQuestionButtonProps) {
  const foreground = useResolveClassNames("text-foreground").color;
  return (
    <Host matchContents seedColor={foreground}>
      <Button
        label="Previous question"
        systemImage="arrow.left"
        onPress={onPress}
        modifiers={[
          buttonStyle("plain"),
          labelStyle("iconOnly"),
          frame({ width: 44, height: 44 }),
          glassEffect({
            glass: { variant: "clear", interactive: true },
            shape: "circle",
          }),
          disabled(isDisabled),
        ]}
      />
    </Host>
  );
}
