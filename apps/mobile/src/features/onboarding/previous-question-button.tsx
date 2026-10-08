import { Host } from "@expo/ui";
import { FilledTonalIconButton, Icon } from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";
import { useResolveClassNames } from "uniwind";

import { ACTION_HEIGHT } from "@/components/action-shared";

export type PreviousQuestionButtonProps = {
  onPress: () => void;
  disabled: boolean;
};

// Material's tonal icon button is the Android equivalent of iOS's clear
// glass circle: a soft, bordered-less affordance rather than plain text.
export function PreviousQuestionButton({
  onPress,
  disabled,
}: PreviousQuestionButtonProps) {
  const primary = useResolveClassNames("bg-primary").backgroundColor;
  return (
    <Host matchContents seedColor={primary}>
      <FilledTonalIconButton
        onClick={onPress}
        enabled={!disabled}
        modifiers={[size(ACTION_HEIGHT, ACTION_HEIGHT)]}
      >
        <Icon
          source={require("../../../assets/icons/arrow_back.xml")}
          contentDescription="Previous question"
        />
      </FilledTonalIconButton>
    </Host>
  );
}
