import { Host } from "@expo/ui";
import {
  Icon,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
} from "@expo/ui/jetpack-compose";
import { width } from "@expo/ui/jetpack-compose/modifiers";
import { useResolveClassNames } from "uniwind";

import type { DecisionPickerProps } from "./decision-picker";

const CHOICES = [
  { value: "shop", icon: require("../../../assets/icons/shopping-cart.xml") },
  { value: "home", icon: require("../../../assets/icons/home.xml") },
] as const;

export function DecisionPicker({
  value,
  onChange,
  disabled = false,
}: DecisionPickerProps) {
  const seedColor = useResolveClassNames("text-primary").color;
  const activeContainerColor = useResolveClassNames("bg-accent").backgroundColor;
  const activeContentColor = useResolveClassNames("text-accent-foreground").color;
  const inactiveContainerColor = useResolveClassNames("bg-card").backgroundColor;
  const inactiveContentColor = useResolveClassNames("text-foreground").color;
  const borderColor = useResolveClassNames("border-border").borderColor;
  const colors = {
    activeContainerColor,
    activeContentColor,
    inactiveContainerColor,
    inactiveContentColor,
    activeBorderColor: borderColor,
    inactiveBorderColor: borderColor,
  };

  return (
    <Host seedColor={seedColor} matchContents>
      <SingleChoiceSegmentedButtonRow modifiers={[width(128)]}>
        {CHOICES.map((choice) => (
          <SegmentedButton
            key={choice.value}
            colors={colors}
            selected={value === choice.value}
            enabled={!disabled}
            onClick={() => onChange(choice.value)}
          >
            <SegmentedButton.Label>
              <Icon source={choice.icon} size={20} />
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
