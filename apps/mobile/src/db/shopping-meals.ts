import type { PlannedMeal } from "./schema";

export type ShoppingMeal = PlannedMeal & {
  display_name: string | null;
  shopping_reviewed: number;
};

// Recipe reviews can be complete with nothing chosen. Written meals are
// covered as soon as they have a shopping item, including one already bought.
// Keep the same rule on the plan, the List and the meal-selection screen.
export const MEALS_WITH_SHOPPING = `
  SELECT pm.*, COALESCE(pm.name, v.name) AS display_name,
         CASE WHEN pm.variant_id IS NOT NULL
           THEN pm.shopping_reviewed_variant_id IS pm.variant_id
           ELSE EXISTS (
             SELECT 1 FROM list_items i
              WHERE i.planned_meal_id = pm.id AND i.list_id = pm.list_id
           )
         END AS shopping_reviewed
    FROM planned_meals pm
    LEFT JOIN variants v ON v.id = pm.variant_id`;
