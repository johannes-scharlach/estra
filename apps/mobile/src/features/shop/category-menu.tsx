// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { CategoryMenu } from "./category-menu.android";

export type Category = {
  id: string;
  name: string;
};

export type CategoryMenuProps = {
  categories: Category[];
  categoryId: string | null;
  categoryName: string | null;
  onSelect: (categoryId: string | null) => void;
};
