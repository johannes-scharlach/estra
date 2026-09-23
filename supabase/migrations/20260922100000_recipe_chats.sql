-- ADR 14: recipe history is separate from general household conversations.
alter table public.chats
  add column recipe_id uuid references public.recipes (id) on delete cascade,
  add column initial_variant_id uuid references public.variants (id) on delete set null,
  add column planned_meal_id uuid references public.planned_meals (id) on delete set null;

create index chats_recipe_recent_idx
  on public.chats (list_id, recipe_id, updated_at desc);

-- Existing membership RLS, publication and replica identity cover these columns.
