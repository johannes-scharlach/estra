// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { DecisionPicker } from "./decision-picker.android";

export type DecisionPickerProps = {
  /** Null until the ingredient is decided: no segment is selected. */
  value: "shop" | "home" | null;
  onChange: (value: "shop" | "home") => void;
  /** Shows a settled choice that can no longer change. */
  disabled?: boolean;
};
