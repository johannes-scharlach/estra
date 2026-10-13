-- First-run challenge (spec 0011): how a chat started and where a recipe came
-- from, so progress is counted from the data itself.

-- Null for recipe and meal chats, which their recipe_id / planned_meal_id
-- already mark, and for chats from before this column.
alter table public.chats
  add column entry text
    check (entry in ('on_hand', 'dish', 'idea'));

-- Import sets 'import'; a chat save copies the chat's entry.
alter table public.recipes
  add column origin text
    check (origin in ('import', 'on_hand', 'dish', 'idea'));

update public.recipes set origin = 'import' where from_url is not null;

-- Existing membership RLS, publication and replica identity cover these columns.
