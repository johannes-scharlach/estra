// What both platform files of action agree on. It lives apart
// because `./action` resolves to the .ios file on iOS, so the
// .ios file importing it would import itself.
export type ActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  // Quiet action for something that removes data: seeded from destructive.
  destructive?: boolean;
};
export const ACTION_HEIGHT = 50;
