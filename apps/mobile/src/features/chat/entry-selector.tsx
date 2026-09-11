// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { EntrySelector } from "./entry-selector.android";

export type EntrySelectorProps = {
  value: "ingredients" | "dish";
  onChange: (value: "ingredients" | "dish") => void;
};
