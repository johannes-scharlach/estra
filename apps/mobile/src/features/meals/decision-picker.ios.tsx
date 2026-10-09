import { Host } from "@expo/ui";
import { Image, Picker } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  disabled,
  frame,
  pickerStyle,
  tag,
  foregroundStyle as tint,
} from "@expo/ui/swift-ui/modifiers";
import { useResolveClassNames } from "uniwind";

import type { DecisionPickerProps } from "./decision-picker";

export function DecisionPicker({
  value,
  onChange,
  disabled: isDisabled = false,
}: DecisionPickerProps) {
  const seedColor = useResolveClassNames("text-primary").color;
  const tintColor = useResolveClassNames("button-primary").color ?? "#0000FF";
  return (
    <Host seedColor={seedColor} matchContents>
      <Picker<"shop" | "home" | null>
        label="Shop or at home"
        selection={value}
        onSelectionChange={(next) => next && onChange(next)}
        modifiers={[
          pickerStyle("segmented"),
          frame({ width: 112 }),
          disabled(isDisabled),
        ]}
      >
        <Image
          systemName={value === "shop" ? "cart.fill" : "cart"}
          modifiers={[
            tag("shop"),
            accessibilityLabel("To shop"),
            tint(tintColor),
          ]}
        />
        <Image
          systemName={value === "home" ? "house.fill" : "house"}
          modifiers={[
            tag("home"),
            accessibilityLabel("At home"),
            tint(tintColor),
          ]}
        />
      </Picker>
    </Host>
  );
}
