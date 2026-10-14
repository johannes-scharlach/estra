-- Existing portion references above the new cap settle at the maximum.
UPDATE public.household_people
SET portion_reference = 2
WHERE portion_reference > 2;

ALTER TABLE public.household_people
  DROP CONSTRAINT household_people_portion_reference_check;

ALTER TABLE public.household_people
  ADD CONSTRAINT household_people_portion_reference_check
    CHECK (portion_reference >= 0.25 AND portion_reference <= 2
      AND portion_reference * 20 = floor(portion_reference * 20));
