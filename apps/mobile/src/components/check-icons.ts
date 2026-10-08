// Checkboxes are circles on iOS (Reminders) and squares on Android, where a
// circle reads as a radio button, i.e. a single choice.
export const CHECKED_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_box",
} as const;
export const UNCHECKED_ICON = {
  ios: "circle",
  android: "check_box_outline_blank",
} as const;

// Radio buttons: one choice among several.
export const SELECTED_ICON = {
  ios: "checkmark.circle.fill",
  android: "radio_button_checked",
} as const;
export const UNSELECTED_ICON = {
  ios: "circle",
  android: "radio_button_unchecked",
} as const;
