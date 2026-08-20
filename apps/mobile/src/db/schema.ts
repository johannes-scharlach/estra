import { column, Schema, Table } from '@powersync/react-native';

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
  { indexes: { by_list: ['list_id'] } },
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
  },
  {
    indexes: {
      by_list_status: ['list_id', 'status'],
      by_recent: ['list_id', 'updated_at'],
    },
  },
);

export const AppSchema = new Schema({
  categories,
  lists,
  list_members,
  list_items,
});

export type Database = (typeof AppSchema)['types'];
export type Category = Database['categories'];
export type List = Database['lists'];
export type ListMember = Database['list_members'];
export type ListItem = Database['list_items'];

export type ItemStatus = 'active' | 'purchased';
