-- The adjust route writes a variant for a meal's eaters and extra. It stamps
-- who that was, so a device can tell whether the recipe still matches the
-- meal by comparing ids, not by reading the yield text (spec 0004, "sized
-- for"). Null: as imported or written by hand, sized only as its text says.
alter table public.variants
  add column sized_for jsonb,
  add constraint variants_sized_for_check check (
    sized_for is null or jsonb_typeof(sized_for) = 'object'
  );
