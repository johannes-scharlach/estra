import { assertEquals } from "jsr:@std/assert@^1";
import { EMPTY_DAY_LINES, mealReminderText } from "./meal-reminder-text.ts";

const day = (
  day_meals: { meal: string; name: string }[],
  items_to_buy = 0,
  slot_date = "2026-10-12",
) => mealReminderText({ slot_date, day_meals, items_to_buy });

Deno.test("a planned day names its meal and what is still to buy", () => {
  assertEquals(day([{ meal: "dinner", name: "Lasagne" }]), {
    title: "Today's dinner",
    body: "Lasagne",
  });
  assertEquals(
    day([{ meal: "dinner", name: "Lasagne" }], 1).body,
    "Lasagne · 1 item still to buy",
  );
});

Deno.test("several meals are named by slot", () => {
  assertEquals(
    day(
      [
        { meal: "lunch", name: "Soup" },
        { meal: "dinner", name: "Lasagne" },
      ],
      3,
    ),
    { title: "Today", body: "Lunch: Soup · Dinner: Lasagne · 3 items still to buy" },
  );
});

Deno.test("an empty day invites planning, with a new line each day of the week", () => {
  const week = ["12", "13", "14", "15", "16", "17", "18"].map((date) =>
    day([], 0, `2026-10-${date}`)
  );
  assertEquals(week[0]!.title, "Tonight's dinner");
  assertEquals(
    new Set(week.map((text) => text.body)),
    new Set(EMPTY_DAY_LINES),
  );
});
