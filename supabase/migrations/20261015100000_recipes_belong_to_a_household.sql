-- ADR 27: every recipe belongs to one list. Members of that list read, write
-- and delete it; planning it into another list plans a copy.

-- --------------------------------------------------------------------------
-- 1. Recipes get a list: the creator's first one.
-- --------------------------------------------------------------------------
alter table public.recipes
  add column list_id uuid references public.lists (id) on delete cascade;

update public.recipes r set list_id = (
  select m.list_id from public.list_members m
  where m.user_id = r.created_by
  order by m.joined_at, m.list_id
  limit 1
);

-- A creator with no list left: the list of a meal that uses it.
update public.recipes r set list_id = (
  select pm.list_id from public.planned_meals pm
  where pm.recipe_id = r.id
  order by pm.created_at, pm.id
  limit 1
)
where r.list_id is null;

-- Unreachable by anyone once recipes are scoped.
delete from public.recipes where list_id is null;

alter table public.recipes
  alter column list_id set not null,
  add constraint recipes_id_list_id_key unique (id, list_id);
create index recipes_list_idx on public.recipes (list_id);

-- --------------------------------------------------------------------------
-- 2. Variants repeat their recipe's list so they sync with one join, like
--    chat_messages. The composite key keeps the two equal.
-- --------------------------------------------------------------------------
alter table public.variants add column list_id uuid;
update public.variants v set list_id = r.list_id
  from public.recipes r where r.id = v.recipe_id;
alter table public.variants
  alter column list_id set not null,
  drop constraint variants_recipe_id_fkey,
  add constraint variants_recipe_id_list_id_fkey
    foreign key (recipe_id, list_id) references public.recipes (id, list_id)
    on delete cascade;
create index variants_list_idx on public.variants (list_id);

-- --------------------------------------------------------------------------
-- 3. A recipe in use on the plan can't be deleted. NO ACTION is checked at
--    the end of the statement, so deleting a whole list still cascades.
-- --------------------------------------------------------------------------
alter table public.planned_meals
  drop constraint planned_meals_recipe_id_fkey,
  add constraint planned_meals_recipe_id_fkey
    foreign key (recipe_id) references public.recipes (id),
  drop constraint planned_meals_variant_id_fkey,
  add constraint planned_meals_variant_id_fkey
    foreign key (variant_id) references public.variants (id);

-- --------------------------------------------------------------------------
-- 4. Copying a variant into a list. Ids derive from the target list and the
--    source variant (magpieUuidV5 in apps/api and apps/mobile; keep the
--    namespace and encoding in step), so repeats make the same rows.
--    Returns the variant to use in the target list. Unchecked: callers
--    authorize (copy_variant_to_list below, or this migration).
-- --------------------------------------------------------------------------
create function public.copy_variant(source_variant_id uuid, target_list_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source public.variants;
  copy_recipe_id uuid := extensions.uuid_generate_v5(
    '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77',
    format('["recipe-copy","%s","%s"]', target_list_id, source_variant_id));
  copy_variant_id uuid := extensions.uuid_generate_v5(
    '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77',
    format('["variant-copy","%s","%s"]', target_list_id, source_variant_id));
begin
  select * into source from public.variants where id = source_variant_id;
  if source.id is null then
    raise exception 'Recipe not found' using errcode = 'P0002';
  end if;
  if source.list_id = target_list_id then
    return source.id;
  end if;
  insert into public.recipes (id, list_id, from_name, from_url, next_ingredient_id)
    select copy_recipe_id, target_list_id, r.from_name, r.from_url, r.next_ingredient_id
    from public.recipes r where r.id = source.recipe_id
    on conflict (id) do nothing;
  insert into public.variants (id, recipe_id, list_id, name, description, locale, total_time,
      recipe_yield, content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions)
    values (copy_variant_id, copy_recipe_id, target_list_id, source.name, source.description,
      source.locale, source.total_time, source.recipe_yield, source.content_markdown,
      source.recipe_category, source.recipe_cuisine, source.ingredient_lines, source.instructions)
    on conflict (id) do nothing;
  return copy_variant_id;
end $$;

revoke execute on function public.copy_variant(uuid, uuid) from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- 5. Meals and chats that point into another list get a copy of their own.
-- --------------------------------------------------------------------------
do $$
declare
  meal record;
  chat record;
  copy_id uuid;
begin
  for meal in
    select pm.id, pm.list_id, pm.variant_id from public.planned_meals pm
    join public.variants v on v.id = pm.variant_id
    where v.list_id <> pm.list_id
  loop
    copy_id := public.copy_variant(meal.variant_id, meal.list_id);
    update public.planned_meals set
      variant_id = copy_id,
      recipe_id = (select recipe_id from public.variants where id = copy_id),
      shopping_reviewed_variant_id = case
        when shopping_reviewed_variant_id = meal.variant_id then copy_id
        else shopping_reviewed_variant_id end
    where id = meal.id;
    update public.list_items set variant_id = copy_id
      where planned_meal_id = meal.id and variant_id = meal.variant_id;
  end loop;

  for chat in
    select c.id, c.list_id, c.initial_variant_id from public.chats c
    join public.recipes r on r.id = c.recipe_id
    where r.list_id <> c.list_id and c.initial_variant_id is not null
  loop
    copy_id := public.copy_variant(chat.initial_variant_id, chat.list_id);
    update public.chats set
      initial_variant_id = copy_id,
      recipe_id = (select recipe_id from public.variants where id = copy_id)
    where id = chat.id;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 6. Planning across lists and sharing (ADR 28) both copy. Holding a variant
--    id is the permission to copy it into a list you belong to.
-- --------------------------------------------------------------------------
create function public.copy_variant_to_list(source_variant_id uuid, target_list_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_list_member(target_list_id) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  return public.copy_variant(source_variant_id, target_list_id);
end $$;

revoke execute on function public.copy_variant_to_list(uuid, uuid) from public, anon;
grant execute on function public.copy_variant_to_list(uuid, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 7. Members only. Upserts scan under the SELECT policy too
--    (docs/schema-changes.md), so every command checks the same list.
-- --------------------------------------------------------------------------
drop policy "recipes are readable" on public.recipes;
drop policy "recipes are writable" on public.recipes;
drop policy "recipes are updatable" on public.recipes;
drop policy "variants are readable" on public.variants;
drop policy "variants are writable" on public.variants;
drop policy "variants are updatable" on public.variants;

create policy "members have full access to recipes" on public.recipes
  for all to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));
create policy "members have full access to variants" on public.variants
  for all to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));
