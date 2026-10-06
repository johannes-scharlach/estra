import { assertEquals } from 'jsr:@std/assert@^1';
import { type MealActivity, mealActivityText, todayIn } from './meal-activity-text.ts';

// Twin of apps/mobile/src/features/activity/meal-activity-text.test.ts.

// Wednesday.
const today = '2026-10-07';
const planned: MealActivity = {
  kind: 'meal_planned',
  actor_name: 'Anna',
  meal_name: 'Lasagne',
  slot_date: '2026-10-08',
  meal: 'dinner',
  previous_meal_name: null,
  previous_slot_date: null,
  previous_meal: null,
};

Deno.test('leads with the slot, then the meal, then who', () => {
  assertEquals(mealActivityText(planned, today), {
    title: "Tomorrow's dinner",
    body: 'Lasagne · Anna',
  });
});

Deno.test('names today and tomorrow, and later days by weekday', () => {
  assertEquals(
    mealActivityText({ ...planned, slot_date: today, meal: 'lunch' }, today).title,
    "Today's lunch",
  );
  assertEquals(
    mealActivityText({ ...planned, slot_date: '2026-10-09' }, today).title,
    "Friday's dinner",
  );
});

Deno.test('says what is there now, then where it came from', () => {
  const body = (change: Partial<MealActivity>) =>
    mealActivityText({ ...planned, ...change }, today).body;
  assertEquals(
    body({ kind: 'meal_changed', meal_name: 'Vegan lasagne', previous_meal_name: 'Lasagne' }),
    'Vegan lasagne, was Lasagne · Anna',
  );
  assertEquals(
    body({ kind: 'meal_changed', previous_meal_name: 'Lasagne' }),
    'Lasagne, recipe changed · Anna',
  );
  assertEquals(
    body({ kind: 'meal_replaced', meal_name: 'Pasta', previous_meal_name: 'Lasagne' }),
    'Pasta, instead of Lasagne · Anna',
  );
  assertEquals(body({ kind: 'meal_removed' }), 'Lasagne removed · Anna');
});

Deno.test('names only the part of the origin that differs', () => {
  const moved = (previous_slot_date: string, previous_meal: string, meal = 'dinner') =>
    mealActivityText(
      { ...planned, kind: 'meal_moved', meal, previous_slot_date, previous_meal },
      today,
    ).body;
  assertEquals(moved(today, 'dinner'), 'Lasagne, moved from today · Anna');
  assertEquals(moved(today, 'dinner', 'lunch'), "Lasagne, moved from today's dinner · Anna");
  assertEquals(moved('2026-10-08', 'lunch'), 'Lasagne, moved from lunch · Anna');
});

Deno.test('without a known today, every day is a weekday', () => {
  const moved = { ...planned, kind: 'meal_moved' as const, previous_slot_date: today,
    previous_meal: 'dinner' };
  assertEquals(mealActivityText(moved, null), {
    title: "Thursday's dinner",
    body: 'Lasagne, moved from Wednesday · Anna',
  });
});

Deno.test("today is the recipient's date, not the server's", () => {
  const lateEvening = new Date('2026-10-07T22:30:00Z');
  assertEquals(todayIn('Europe/Berlin', lateEvening), '2026-10-08');
  assertEquals(todayIn('America/New_York', lateEvening), '2026-10-07');
  assertEquals(todayIn(null, lateEvening), null);
  assertEquals(todayIn('Not/A_Zone', lateEvening), null);
});
