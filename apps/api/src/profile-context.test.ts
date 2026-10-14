import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newPerson,
  newProfile,
  profileContext,
  householdSchema,
  profileChangesSchema,
} from "@magpie/profile";

test("household context preserves restrictions and routines without inventing inventory or equipment", () => {
  const profile = newProfile();
  profile.goals = {
    "fast-weeknight-dinners": true,
    other: ["Cook with the children"],
  };
  profile.kitchen_equipment = { other: [] };
  profile.meals_at_home = "Weekday dinners, lunches and dinners on weekends";
  profile.other_shops = "The Asian shop takes a special trip";
  // Old broad selections remain broad; they must not invent specific foods.
  profile.pantry = { cannedFoods: true, other: [] };
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
  assert.match(context, /Flexitarian .* still regularly eats meat and fish/);
  assert.deepEqual(data.equipment, []);
  assert.deepEqual(data.goals, [
    "Fast weeknight dinners",
    "Cook with the children",
  ]);
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

test("onboarding choices retain their meaning through validation and assistant context", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      pantry: { "canned-tomatoes": true, other: ["Polenta"] },
      fresh_ingredients: {
        "greek-yoghurt": true,
        "chinese-cabbage": true,
        other: [],
      },
      ingredient_avoidances: [
        { ingredient: "Peanuts", kind: "allergy", detail: "Sam" },
        { ingredient: "Coriander", kind: "dislike", detail: "" },
      ],
      shops: [{ name: "Asian supermarket", access: "detour" }],
    },
    people: [
      {
        ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
        name: "Sam",
        portion_reference: 0.75,
      },
    ],
  });
  const context = profileContext(household, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.equal(data.people[0].portion_reference, 0.75);
  assert.deepEqual(data.usual_pantry_items, ["Canned tomatoes", "Polenta"]);
  assert.deepEqual(data.regular_fresh_purchases, [
    "Greek yoghurt",
    "Chinese cabbage",
  ]);
  assert.equal(data.ingredient_avoidances[0].kind, "allergy");
  assert.equal(data.ingredient_avoidances[1].kind, "dislike");
  assert.deepEqual(data.shops, [
    { name: "Asian supermarket", access: "detour" },
  ]);
  assert.match(context, /portion_reference.*extra portions/);
  assert.match(context, /rotation/);
  assert.deepEqual(newProfile().pantry, { other: [] });
  assert.deepEqual(newProfile().fresh_ingredients, { other: [] });
  const acceptsPortion = (portion_reference: number) =>
    householdSchema.safeParse({
      ...household,
      people: [{ ...household.people[0], portion_reference }],
    }).success;
  assert.equal(acceptsPortion(0.25), true);
  assert.equal(acceptsPortion(0.3), true);
  assert.equal(acceptsPortion(2), true);
  assert.equal(acceptsPortion(0.2), false);
  assert.equal(acceptsPortion(0.31), false);
  assert.equal(acceptsPortion(2.05), false);
});

test("editing one profile section never inserts defaults into other sections", () => {
  assert.deepEqual(profileChangesSchema.parse({ main_supermarket: "Aldi" }), {
    main_supermarket: "Aldi",
  });
  assert.deepEqual(profileChangesSchema.parse({ shops: [] }), { shops: [] });
});
