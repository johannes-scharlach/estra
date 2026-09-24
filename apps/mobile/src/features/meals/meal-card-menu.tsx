// Match the platform siblings' extension so Metro selects .ios.tsx on iOS.
export { MealCardMenu } from "./meal-card-menu.android";

export type MealCardMenuProps = {
  recipeId: string;
  recipeName: string;
  eatersLabel: string;
  onEditEaters: () => void;
  onChange: () => void;
  onMove: () => void;
  onRepeat: () => void;
  onSkip: () => void;
};
