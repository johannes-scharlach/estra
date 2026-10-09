import { assertEquals } from "jsr:@std/assert@^1";
import { type ClaimedDelivery, pushMessage } from "./notification-delivery.ts";

const now = new Date("2026-10-07T10:00:00Z");
const join: ClaimedDelivery = {
  id: "delivery-1",
  activity_id: "activity-1",
  list_id: "list-1",
  user_id: "user-1",
  device_id: "device-1",
  expo_push_token: "ExpoPushToken[ben]",
  status: "pending",
  attempt_count: 0,
  expo_ticket_id: null,
  ticket_sent_at: null,
  time_zone: "Europe/Berlin",
  household_name: "Family",
  kind: "member_joined",
  actor_name: "Anna",
  meal_name: null,
  slot_date: null,
  meal: null,
  previous_meal_name: null,
  previous_slot_date: null,
  previous_meal: null,
  item_names: null,
  day_meals: null,
  items_to_buy: null,
};

Deno.test("a join names the household", () => {
  const message = pushMessage(join, now);
  assertEquals(
    [message.title, message.body],
    ["Family", "Anna joined your household."],
  );
  assertEquals(message.data, {
    type: "household_activity",
    listId: "list-1",
    activityId: "activity-1",
    userId: "user-1",
    kind: "member_joined",
    slotDate: null,
  });
});

Deno.test(
  "a meal push reads like the activity row, in the recipient's day",
  () => {
    const message = pushMessage(
      {
        ...join,
        kind: "meal_planned",
        meal_name: "Lasagne",
        slot_date: "2026-10-08",
        meal: "dinner",
      },
      now,
    );
    assertEquals(
      [message.title, message.body],
      ["Tomorrow's dinner", "Lasagne · Anna"],
    );
    assertEquals(message.data.kind, "meal_planned");
    assertEquals(message.data.slotDate, "2026-10-08");
  },
);

Deno.test("a list push names what was added", () => {
  const message = pushMessage(
    { ...join, kind: "items_added", item_names: ["Milk", "eggs"] },
    now,
  );
  assertEquals(
    [message.title, message.body],
    ["Added to the List", "Milk, eggs · Anna"],
  );
  assertEquals(message.data.kind, "items_added");
});

Deno.test("a reminder opens its day and has no activity", () => {
  const message = pushMessage(
    {
      ...join,
      activity_id: null,
      kind: "meal_reminder",
      actor_name: null,
      slot_date: "2026-10-07",
      day_meals: [{ meal: "dinner", name: "Lasagne" }],
      items_to_buy: 2,
    },
    now,
  );
  assertEquals(
    [message.title, message.body],
    ["Today's dinner", "Lasagne · 2 items still to buy"],
  );
  assertEquals(message.data.activityId, null);
  assertEquals(message.data.slotDate, "2026-10-07");
});
