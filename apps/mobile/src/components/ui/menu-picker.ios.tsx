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
    // SwiftUI avoids the keyboard inside the host by default, which lifts
    // the picker out of its row whenever a field in the same form focuses.
    <Host matchContents seedColor={primary} ignoreSafeArea="keyboard">
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
