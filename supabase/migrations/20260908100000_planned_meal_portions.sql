-- Widen in place: existing integer portions, defaults and references survive.
alter table public.planned_meals
  alter column servings type double precision using servings::double precision;

-- Use a decimal round-trip rather than floating-point multiplication by 100.
-- Text preserves the float's round-trip precision before decimal rounding.
alter table public.planned_meals
  add constraint planned_meals_servings_check check (
    case when servings > 0 and servings < 'Infinity'::double precision
      then servings = round(servings::text::numeric, 2)::double precision
      else false
    end
  );
