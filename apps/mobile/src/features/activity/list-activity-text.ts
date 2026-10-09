// Twin of supabase/functions/_shared/list-activity-text.ts (spec 0009).
// Keep the two in step; both test files cover the same cases.

export type ListActivity = {
  kind: "items_added" | "items_bought";
  actor_name: string;
  item_names: string[];
};

/** What first, then who: "Added to the List" / "Milk, eggs, lemons +3 · Anna". */
export function listActivityText(activity: ListActivity) {
  const names = activity.item_names;
  if (activity.kind === "items_bought") {
    return {
      title: "Shopping done",
      body: `${names.length} ${names.length === 1 ? "item" : "items"} bought · ${activity.actor_name}`,
    };
  }
  const rest = names.length > 3 ? ` +${names.length - 3}` : "";
  return {
    title: "Added to the List",
    body: `${names.slice(0, 3).join(", ")}${rest} · ${activity.actor_name}`,
  };
}
