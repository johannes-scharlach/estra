import assert from "node:assert/strict";
import { test } from "node:test";
import { newPerson, newProfile, profileContext } from "@estra/profile";

test("household context preserves restrictions and routines without inventing inventory or equipment", () => {
  const profile = newProfile();
  profile.goals = { "save-time": true, other: ["Cook with the children"] };
  profile.kitchen_equipment = { other: [] };
  profile.meals_at_home = "Weekday dinners, lunches and dinners on weekends";
  profile.other_shops = "The Asian shop takes a special trip";
  const person = {
    ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
    name: "Sam",
    user_id: "a5b28b6b-8fba-432b-bfe3-b2e8afca06bc",
    meal_times: "Weekday dinners",
  };
  profile.restrictions = "Severe peanut allergy";
  const child = {
    ...newPerson("f748aee7-247b-4bf3-b89f-a42d0eaa9157"),
    name: "Sam",
    age_group: "Child" as const,
    diet: "vegetarian" as const,
  };
  const context = profileContext(
    { profile, people: [person, child] },
    person.user_id,
  );
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.equal(data.people.length, 2);
  assert.equal(data.people[0].is_current_user, true);
  assert.equal(data.people[1].is_current_user, false);
  assert.equal(data.household_restrictions, "Severe peanut allergy");
  assert.match(data.people[0].diet_meaning, /still eats meat and fish/);
  assert.deepEqual(data.equipment, []);
  assert.deepEqual(data.goals, ["Save time", "Cook with the children"]);
  assert.equal(
    data.meals_at_home,
    "Weekday dinners, lunches and dinners on weekends",
  );
  assert.equal(data.other_shops, "The Asian shop takes a special trip");
  assert.ok(data.usual_pantry_categories.includes("Canned foods"));
  assert.doesNotMatch(context, /tuna|chickpeas/);
  assert.match(context, /not current inventory/);
  assert.match(context, /allergies and restrictions over preferences/);
});
