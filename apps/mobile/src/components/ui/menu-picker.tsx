// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { MenuPicker } from "./menu-picker.android";

export type MenuPickerProps = {
  /** Accessible name of the field this controls, e.g. "Age group". */
  label: string;
  choices: readonly string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  className?: string;
};
