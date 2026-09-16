// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { MealCardMenu } from "./meal-card-menu.android";

export type MealCardMenuProps = {
  recipeId: string;
  recipeName: string;
  servings: number | null;
  onEditPortions: () => void;
  onChange: () => void;
  onMove: () => void;
  onSkip: () => void;
};
