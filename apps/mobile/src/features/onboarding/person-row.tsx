// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { PersonRow } from "./person-row.android";

export type PersonRowProps = {
  name: string;
  detail: string;
  onEdit: () => void;
  onRemove: () => void;
};
