-- ADR 20: ingredient identity and meal choices are independent of shopping.
alter table public.recipes add column next_ingredient_id integer not null default 1 check (next_ingredient_id > 0);
alter table public.planned_meals add column ingredient_swaps jsonb not null default '{}'::jsonb
  check (jsonb_typeof(ingredient_swaps) = 'object');
alter table public.list_items add column ingredient_id integer check (ingredient_id > 0);

-- Existing versions have no reliable cross-version identity. Allocate distinct
-- ids; future rewrites preserve their base version's ids explicitly.
do $$
declare r record; v record; counter integer; lines jsonb; entry jsonb;
begin
  for r in select id from public.recipes loop
    counter := 1;
    for v in select id, ingredient_lines from public.variants where recipe_id = r.id order by created_at, id loop
      lines := '[]'::jsonb;
      for entry in select value from jsonb_array_elements(v.ingredient_lines) loop
        lines := lines || jsonb_build_array(entry || jsonb_build_object('id', counter));
        counter := counter + 1;
      end loop;
      update public.variants set ingredient_lines = lines where id = v.id;
    end loop;
    update public.recipes set next_ingredient_id = counter where id = r.id;
  end loop;
end $$;

-- Recover only unambiguous links and choices. Unmatched rows keep their saved
-- details; migration never deletes purchases or guesses ingredient identity.
with options as (
  select pm.id meal_id, (line->>'id')::integer ingredient_id,
    lower(regexp_replace(btrim(option->>'item_name'), '\s+', ' ', 'g')) name_key,
    row_number() over (partition by pm.id, line->>'id' order by ord) - 1 option_index
  from public.planned_meals pm
  join public.variants v on v.id = pm.variant_id
  cross join lateral jsonb_array_elements(v.ingredient_lines) line
  cross join lateral (
    select distinct on (lower(regexp_replace(btrim(value->>'item_name'), '\s+', ' ', 'g')))
      value option, ordinality ord
    from jsonb_array_elements(jsonb_build_array(line) || coalesce(line->'swaps', '[]'::jsonb)) with ordinality
    order by lower(regexp_replace(btrim(value->>'item_name'), '\s+', ' ', 'g')), ordinality
  ) o
), matches as (
  select i.id, i.planned_meal_id, o.ingredient_id, o.option_index,
    count(*) over (partition by i.id) claims,
    count(*) over (partition by i.planned_meal_id, o.ingredient_id) items
  from public.list_items i join options o on o.meal_id = i.planned_meal_id and o.name_key = i.name_key
), linked as (
  update public.list_items i set ingredient_id = m.ingredient_id
  from matches m where i.id = m.id and m.claims = 1 and m.items = 1
  returning i.planned_meal_id, m.ingredient_id, m.option_index
)
update public.planned_meals pm set ingredient_swaps = choices.swaps
from (
  select planned_meal_id, jsonb_object_agg(ingredient_id::text, option_index) filter (where option_index > 0) swaps
  from linked group by planned_meal_id
) choices where pm.id = choices.planned_meal_id and choices.swaps is not null;

-- Enforce presence for every writer, including seeds. API writes additionally
-- validate preserved ids against the explicit base variant.
create function public.ensure_ingredient_ids() returns trigger language plpgsql as $$
declare counter integer; entry jsonb; lines jsonb := '[]'::jsonb; used integer[] := '{}'; ingredient integer;
begin
  select next_ingredient_id into counter from public.recipes where id = new.recipe_id for update;
  for entry in select value from jsonb_array_elements(new.ingredient_lines) loop
    ingredient := (entry->>'id')::integer;
    if ingredient is null then
      ingredient := counter;
      counter := counter + 1;
    end if;
    if ingredient < 1 or ingredient = any(used) then
      raise exception 'Ingredient ids must be positive and unique within a variant';
    end if;
    counter := greatest(counter, ingredient + 1);
    used := array_append(used, ingredient);
    lines := lines || jsonb_build_array(entry || jsonb_build_object('id', ingredient));
  end loop;
  update public.recipes set next_ingredient_id = counter where id = new.recipe_id;
  new.ingredient_lines := lines;
  return new;
end $$;
create trigger variants_ingredient_ids before insert or update of ingredient_lines on public.variants
  for each row execute function public.ensure_ingredient_ids();
