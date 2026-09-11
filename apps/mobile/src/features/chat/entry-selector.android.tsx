import { Host } from "@expo/ui";
import { SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useResolveClassNames } from "uniwind";

import type { EntrySelectorProps } from "./entry-selector";

export function EntrySelector({ value, onChange }: EntrySelectorProps) {
  const seedColor = useResolveClassNames("text-primary").color;
  const activeContainerColor = useResolveClassNames("bg-accent").backgroundColor;
  const activeContentColor = useResolveClassNames("text-accent-foreground").color;
  const inactiveContainerColor = useResolveClassNames("bg-background").backgroundColor;
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
    <Host seedColor={seedColor} matchContents={{ vertical: true }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        <SegmentedButton colors={colors} selected={value === "ingredients"} onClick={() => onChange("ingredients")}>
          <SegmentedButton.Label><Text>Ingredients</Text></SegmentedButton.Label>
        </SegmentedButton>
        <SegmentedButton colors={colors} selected={value === "dish"} onClick={() => onChange("dish")}>
          <SegmentedButton.Label><Text>Dish in mind</Text></SegmentedButton.Label>
        </SegmentedButton>
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
