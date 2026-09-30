# 20. Meals own ingredient choices; purchases are snapshots

Date: 2026-09-29
Status: Accepted
Supersedes: 13 (swap ownership and adjustment reconciliation)

Choosing tuna instead of sardines is a meal decision, including when tuna is
already at home. It must persist without a shopping item.

- Ingredient lines have positive integer ids, allocated by a recipe-level
  counter. A rewrite preserves an existing ingredient's id through swaps,
  quantity changes and reordering. New ingredients receive fresh ids; removed
  ids are never recycled. Identity is not inferred from names.
- `planned_meals.ingredient_swaps` maps ingredient ids to alternative indexes
  in its current variant. All three screens edit that one source of truth.
  Concurrent edits to the same meal's map use existing last-write semantics;
  no new conflict-resolution subsystem.
- A recipe shopping item references the meal and ingredient id. Active details
  resolve from the meal's choice; stored name, spec and category are fallback
  snapshots, not a second authoritative choice.
- Checking off snapshots the resolved details. Purchased rows always display
  that snapshot, even if the meal later changes or removes the ingredient.
- Adjust writes a variant, clears incorporated choices and reconciles shopping
  in one transaction. A rewrite that leaves a choice unapplied carries it to
  the new alternative index; it cannot silently discard a retained ingredient's
  choice. Outstanding removed ingredients are deleted. Purchases survive. New
  ingredients require explicit shopping selection.
- Review state remains independent from ingredient choices and shopping rows.

Existing variants receive distinct ids because their historical correspondence
cannot be recovered reliably. Existing shopping links and choices are backfilled
only when name matching is unambiguous; unmatched rows retain saved details.
