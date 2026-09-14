-- Refined 16 shopping categories aligned with store topology and shopping flow

insert into public.categories (id, name, sort_order) values
  ('produce',    'Fruit & Vegetables',           10),
  ('bakery',     'Bread & Pastries',             20),
  ('deli',       'Cold Cuts, Cheese & Deli',     30),
  ('dairy',      'Dairy, Butter & Yogurt',       40),
  ('meat',       'Fresh Meat & Fish',            50),
  ('breakfast',  'Breakfast & Hot Drinks',       60),
  ('grains',     'Grain Products',               70),
  ('spices',     'Ingredients, Spices & Baking', 80),
  ('snacks',     'Snacks & Sweets',              90),
  ('frozen',     'Frozen & Convenience',        100),
  ('beverages',  'Beverages',                   110),
  ('care',       'Care & Health',               120),
  ('household',  'Household',                   130),
  ('pets',       'Pet Supplies',                140),
  ('home',       'Home & Garden',               150),
  ('other',      'Other',                       999)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

-- Remap retired category keys on existing list_items before dropping them
update public.list_items set category_id = 'spices' where category_id = 'pantry';
update public.list_items set category_id = 'beverages' where category_id = 'drinks';
update public.list_items set category_id = 'care' where category_id = 'personal';

-- Drop retired categories
delete from public.categories where id in ('pantry', 'drinks', 'personal');
