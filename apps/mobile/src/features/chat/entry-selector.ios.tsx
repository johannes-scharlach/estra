import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import type { EntrySelectorProps } from "./entry-selector";

export function EntrySelector({ value, onChange }: EntrySelectorProps) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Picker
        label="Start a spontaneous meal"
        selection={value}
        onSelectionChange={onChange}
        modifiers={[pickerStyle("segmented")]}
      >
        <Text modifiers={[tag("ingredients")]}>Ingredients</Text>
        <Text modifiers={[tag("dish")]}>Dish in mind</Text>
      </Picker>
    </Host>
  );
}
