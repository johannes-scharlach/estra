import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { useResolveClassNames } from "uniwind";

import type { EntrySelectorProps } from "./entry-selector";

export function EntrySelector({ value, onChange }: EntrySelectorProps) {
  const seedColor = useResolveClassNames("text-primary").color;
  return (
    <Host seedColor={seedColor} matchContents={{ vertical: true }}>
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
