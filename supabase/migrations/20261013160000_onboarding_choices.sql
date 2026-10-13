-- Keep existing free-text notes and category selections intact. New choices
-- distinguish allergies from dislikes and shop access from the shop's name.
ALTER TABLE public.household_profiles
  ADD COLUMN ingredient_avoidances jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(ingredient_avoidances) = 'array'),
  ADD COLUMN shops jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(shops) = 'array');

ALTER TABLE public.household_people
  ADD COLUMN portion_reference double precision NOT NULL DEFAULT 1
    CHECK (portion_reference >= 0.25 AND portion_reference <= 4
      AND portion_reference * 4 = floor(portion_reference * 4));

-- A new household declares its own staples; no categories are preselected.
ALTER TABLE public.household_profiles
  ALTER COLUMN pantry SET DEFAULT '{"other":[]}'::jsonb,
  ALTER COLUMN fresh_ingredients SET DEFAULT '{"other":[]}'::jsonb;
