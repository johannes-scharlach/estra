// What both platform files of primary-action agree on. It lives apart
// because `./primary-action` resolves to the .ios file on iOS, so the
// .ios file importing it would import itself.
export type PrimaryActionProps = { label: string; onPress: () => void };
export const ACTION_HEIGHT = 50;
