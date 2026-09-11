import { Host } from "@expo/ui";
import { SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";

import type { EntrySelectorProps } from "./entry-selector";

export function EntrySelector({ value, onChange }: EntrySelectorProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        <SegmentedButton selected={value === "ingredients"} onClick={() => onChange("ingredients")}>
          <SegmentedButton.Label><Text>Ingredients</Text></SegmentedButton.Label>
        </SegmentedButton>
        <SegmentedButton selected={value === "dish"} onClick={() => onChange("dish")}>
          <SegmentedButton.Label><Text>Dish in mind</Text></SegmentedButton.Label>
        </SegmentedButton>
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
