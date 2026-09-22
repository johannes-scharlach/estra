import { column, Schema, Table } from "@powersync/react-native";

/**
 * The client-side mirror of the Postgres schema in supabase/migrations.
 *
 * Two constraints drive the shape, and both are silent when violated:
 *
 *  1. PowerSync's local SQLite only has `text`, `integer` and `real`.
 *     Booleans become 0/1 and timestamps become ISO strings.
 *  2. A column present in Postgres but missing here simply never arrives on
 *     the device — no error, just `undefined`. Postgres migrations are the
 *     source of truth; adding a column there means adding it here and to
 *     powersync/sync-config.yaml in the same commit.
 *
 * `id` is implicit — PowerSync always creates a TEXT primary key called
 * `id`, generated client-side so rows exist before they sync.
 */

/** Global reference data. Read-only: there are no write policies on it. */
const categories = new Table({
  name: column.text,
  sort_order: column.integer,
});

const lists = new Table({
  name: column.text,
  invite_code: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const list_members = new Table(
  {
    list_id: column.text,
    user_id: column.text,
    joined_at: column.text,
  },
  { indexes: { by_list: ["list_id"] } },
);

const household_profiles = new Table({
  goals: column.text,
  kitchen_equipment: column.text,
  pantry: column.text,
  fresh_ingredients: column.text,
  restrictions: column.text,
  meals_at_home: column.text,
  main_supermarket: column.text,
  other_shops: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const household_people = new Table(
  {
    list_id: column.text,
    user_id: column.text,
    name: column.text,
    age_group: column.text,
    diet: column.text,
    diet_other: column.text,
    meal_times: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_list: ["list_id"] } },
);

const recipes = new Table({
  from_name: column.text,
  from_url: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const variants = new Table({
  recipe_id: column.text,
  name: column.text,
  description: column.text,
  locale: column.text,
  total_time: column.text,
  recipe_yield: column.text,
  content_markdown: column.text,
  recipe_category: column.text,
  recipe_cuisine: column.text,
  /** JSON array of {qty_text, item_name, prep_note, category_id, swaps:[{qty_text,item_name,prep_note,category_id}]} */
  ingredient_lines: column.text,
  instructions: column.text,
  /** JSON {eater_ids, extra_portions} the adjust route sized this for; null as imported. */
  sized_for: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const planned_meals = new Table(
  {
    list_id: column.text,
    recipe_id: column.text,
    variant_id: column.text,
    slot_date: column.text,
    meal: column.text,
    // JSON array of household_people ids; text locally like variants.ingredient_lines.
    eater_ids: column.text,
    extra_portions: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_list_date: ["list_id", "slot_date"] } },
);

const list_items = new Table(
  {
    list_id: column.text,
    name: column.text,
    /** Normalised name; see itemNameKey(). Dedupe key across devices. */
    name_key: column.text,
    category_id: column.text,
    spec: column.text,
    /** 'active' | 'purchased' — purchased rows are the "recent" strip. */
    status: column.text,
    purchase_count: column.integer,
    added_by: column.text,
    created_at: column.text,
    updated_at: column.text,
    /** Null for standalone; set for meal-derived rows (ADR 7). */
    planned_meal_id: column.text,
    variant_id: column.text,
  },
  {
    indexes: {
      by_list_status: ["list_id", "status"],
      by_recent: ["list_id", "updated_at"],
      by_planned_meal: ["planned_meal_id"],
    },
  },
);

/** ADR 9: written only by the API server; clients read. */
const chats = new Table(
  {
    list_id: column.text,
    created_by: column.text,
    title: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_list_recent: ["list_id", "updated_at"] } },
);

const chat_messages = new Table(
  {
    chat_id: column.text,
    list_id: column.text,
    /** 'user' | 'assistant' | 'system' */
    role: column.text,
    /** JSON: AI SDK UIMessage.parts */
    parts: column.text,
    created_at: column.text,
  },
  { indexes: { by_chat: ["chat_id", "created_at"] } },
);

export const AppSchema = new Schema({
  categories,
  lists,
  list_members,
  household_profiles,
  household_people,
  recipes,
  variants,
  planned_meals,
  list_items,
  chats,
  chat_messages,
});

export type Database = (typeof AppSchema)["types"];
export type Category = Database["categories"];
export type List = Database["lists"];
export type ListMember = Database["list_members"];
export type ListItem = Database["list_items"];
export type Recipe = Database["recipes"];
export type Variant = Database["variants"];
export type PlannedMeal = Database["planned_meals"];
export type Chat = Database["chats"];
export type ChatMessage = Database["chat_messages"];

export type ItemStatus = "active" | "purchased";
