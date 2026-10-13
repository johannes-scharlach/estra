import { Host } from "@expo/ui";
import { useResolveClassNames } from "uniwind";
import { Button } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import { ACTION_HEIGHT } from "@/components/action-shared";
import type { PreviousQuestionButtonProps } from "@/features/onboarding/previous-question-button";

export function PreviousQuestionButton({
  onPress,
  disabled: isDisabled,
}: PreviousQuestionButtonProps) {
  const foreground = useResolveClassNames("text-foreground").color;
  return (
    <Host
      style={{ width: ACTION_HEIGHT, height: ACTION_HEIGHT }}
      seedColor={typeof foreground === "string" ? foreground : undefined}
      ignoreSafeArea="all"
    >
      <Button
        label="Previous question"
        systemImage="arrow.left"
        onPress={onPress}
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          controlSize("large"),
          labelStyle("iconOnly"),
          frame({ width: ACTION_HEIGHT, height: ACTION_HEIGHT }),
          disabled(isDisabled),
        ]}
      />
    </Host>
  );
}
