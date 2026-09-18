import { Host, Picker } from "@expo/ui";
import { useResolveClassNames } from "uniwind";

import type { MenuPickerProps } from "./menu-picker";

/** iOS: native compact menu Picker. */
export function MenuPicker({
  choices,
  selectedValue,
  onValueChange,
}: MenuPickerProps) {
  const primary = useResolveClassNames("bg-primary").backgroundColor;
  return (
    <Host matchContents seedColor={primary}>
      <Picker
        appearance="menu"
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      >
        {choices.map((choice) => (
          <Picker.Item key={choice} label={choice} value={choice} />
        ))}
      </Picker>
    </Host>
  );
}
