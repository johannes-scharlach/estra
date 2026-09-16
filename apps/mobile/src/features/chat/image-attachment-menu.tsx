import type { ImageSource } from "./image-attachment";

// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { ImageAttachmentMenu } from "./image-attachment-menu.android";

export type ImageAttachmentMenuProps = {
  onSelect: (source: ImageSource) => void;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
};
