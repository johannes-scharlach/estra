# Native mobile: cooking profile and onboarding

Status: implementation in place; backend rollout and native acceptance pending. Scope and persisted data model confirmed with product owner.

Source: Hobs. Hobs is behavioral reference. A web project that serves as the prototype for Estra. This document is self-contained; access to Hobs source is not needed.

## Problem Statement

A first-time cook wants help that fits their household, diet, kitchen, and shopping habits. They should be able to describe that setup before being asked to create an account. Setup must feel approachable on a phone, survive interruptions, and pay off in personalized cooking help without repeated questions.

A returning User needs a quieter sign-in path that restores their existing setup without repeating onboarding. Both new and returning Users need to inspect and correct what the app knows about their cooking.

## Solution

First launch presents a prominent **Get started** action and a less prominent **Sign in** action. Get started opens a nine-screen cooking-profile wizard, followed by email and a six-digit email verification code. Verified identity plus successfully saved Profile completes onboarding and opens the destination app's main cooking experience.

Preserve Hobs' successful interaction shape: one topic per screen, visible progress, back navigation, helpful defaults, selectable presets, optional custom answers, and no account requirement until the end. Persist draft answers locally while onboarding. Provide a separate Profile view/editor after completion.

The Profile is a household's cooking setup belonging to a list. A list represents the household and its authenticated members share access to the Profile. Household people include everyone regularly cooked for, whether or not they have an account. The Cooking Assistant receives context derived from the same structured data shown to the User.

## User Stories

1. As a first-time cook, I want Get started to be obvious, so that I know how to begin.
2. As a returning User, I want a secondary Sign in action, so that I can restore my setup quickly.
3. As a new User, I want to describe my cooking before entering email, so that I understand what the app will do for me.
4. As a cook, I want one topic per screen and visible progress, so that setup feels manageable.
5. As a cook, I want to go back without losing answers, so that I can correct earlier choices.
6. As a cook, I want setup to resume after closing the app, so that interruptions do not waste my effort.
7. As a cook, I want to enter my preferred name, so that the experience feels personal.
8. As a cook, I want to choose several goals and add my own, so that help reflects what matters to me.
9. As a cook, I want a standard or custom diet, so that my eating pattern is represented accurately.
10. As a flexitarian cook, I want meat and fish to remain valid options, so that plant-forward does not become vegetarian by accident.
11. As a cook, I want to describe allergies, restrictions, and dislikes in my own words, so that details survive setup.
12. As a cook without restrictions, I want a quick None action, so that I can move on.
13. As a cook, I want to see myself in the household without adding myself again, so that household size is correct.
14. As a cook, I want to add, edit, and remove other household members, so that setup matches who regularly eats with me.
15. As a cook, I want each member's age group, diet, restrictions, and meal attendance recorded, so that shared meals fit their needs.
16. As a solo cook, I want to continue without adding anyone else, so that setup works for one person.
17. As a cook, I want to describe which meals I cook at home, including weekday/weekend differences, so that help reflects my normal week.
18. As a cook, I want to describe usual shops and how practical they are to visit, so that sourcing advice fits my routine.
19. As a cook, I want to select equipment and add unlisted equipment, so that suggested methods are feasible.
20. As a cook, I want to describe usual pantry and fresh staples, so that help understands my habits without demanding an inventory.
21. As a cook, I want to remove defaults and custom entries, so that correcting assumptions is easy.
22. As a new User, I want email verification at the end, so that my completed setup belongs to an account I control.
23. As a new User, I want to switch to my email app and return with answers intact, so that verification is painless.
24. As a User, I want to correct my email or request another code, so that delivery mistakes do not trap me.
25. As a User, I want useful errors and retry actions, so that network failures do not make me repeat setup.
26. As a User, I want an interrupted final save to resume safely, so that I do not create duplicate Profiles.
27. As a returning User, I want sign-in to load my existing Profile, so that a fresh draft never silently replaces it.
28. As a User, I want to view every cooking-profile field after signup, so that the app's understanding is inspectable.
29. As a User, I want to edit a section, save it, or cancel it, so that corrections are under my control.
30. As a cook, I want subsequent Cooking Assistant requests to use saved edits, so that I do not have to repeat them in a Conversation.
31. As a mobile User, I want inputs and navigation accessible with the keyboard open and with assistive technology, so that every step is usable.

## Implementation Decisions

### Platform boundary

- Use Estra's Expo Router, Supabase auth, PowerSync persistence, native UI, and testing conventions. Targets are iOS and Android.
- Hobs uses Supabase auth, one structured JSONB Profile per User, and local browser draft storage. These are reference implementation choices, not dependencies to adopt.
- Equivalent modules are: onboarding flow/draft, auth integration, Profile persistence/editor, and Profile-to-assistant-context rendering. Prefer existing target-project boundaries.
- Localization is planned but outside this scope. Keep stable stored option keys independent of UI labels; do not introduce localization infrastructure in this work.

### Entry, navigation, and completion

| State                                   | Behavior                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| No authenticated session, no draft      | Welcome with primary Get started and secondary Sign in.                                                                  |
| No authenticated session, saved draft   | Get started resumes saved cooking answers and step. Sign in remains available.                                           |
| Authenticated, Profile exists           | Load Profile and open main cooking experience.                                                                           |
| Authenticated, Profile confirmed absent | Resume matching unfinished setup or begin missing setup; do not ask for email verification again while session is valid. |
| Profile lookup failed                   | Show retry; a network error does not establish that Profile is absent.                                                   |
| Verified, final save pending/failed     | Retain draft and retry Profile save using authenticated session.                                                         |

- Wizard order: **name → goals → diet → restrictions → household → groceries → kitchen → pantry → fresh → email → code**.
- Suggested chapter labels, matching prototype: The Cook (name/goals), The Diet (diet/restrictions), The Kitchen (household through fresh), The Setup (email/code).
- Back preserves entered answers. Show progress and a labeled primary action. Optional cooking steps allow Next without adding information.
- Selecting a preset diet advances immediately. Selecting None on restrictions clears that field and advances. Other multi-select steps advance explicitly.
- Household add/edit is a nested screen or sheet. Hide parent wizard navigation while editing a person. Save commits that person; cancel/back discards that person's uncommitted edit.
- Completion requires successful authentication and durable local PowerSync writes for the list, creator's list membership, and Profile. Only then clear the associated onboarding draft and navigate to Estra's existing cooking entry point. Upload proceeds through normal PowerSync behavior; server acknowledgement is not a separate completion gate.
- Profile lookup and routing refer to the current list using Estra's existing list-selection behavior. An empty local query before initial sync does not establish that a returning User has no list or Profile. If a current list exists without a Profile, complete its missing setup rather than creating another list.

### Structured data contract

One list has at most one Profile. New-household onboarding creates the list, adds the verified User as a list member, and creates its Profile. A list may temporarily have no Profile while setup is incomplete.

Approved persisted model: `household_profiles.id` is both its primary key and a foreign key to `lists.id`. Store goals, equipment, pantry, fresh staples, meal routine, and shopping notes in separate columns so section edits do not replace unrelated data. `household_people` stores people as separate rows referencing the Profile via `list_id`. Both tables have creation/update timestamps. Authorize reads/writes and sync through list membership. Auth identity/email remains outside cooking data.

Household people and list members are distinct. A household person has a stable locally generated ID even before account creation, and an optional User link; a linked User must be a member of that list and may identify at most one person within its Profile. The draft's `onboarding_person_id` identifies whose details the opening steps edit. During finalization, link that person to the verified User. All other people remain unlinked. Leaving a list clears the User link and retains the person; deleting the list deletes its Profile and people. Invitations and UI for linking other accounts are out of scope.

The following keys and meanings describe the portable cooking payload. Target language may express them as native types. No migration of existing Hobs data is required.

| Field                   | Type / meaning                                                       | New-wizard default            |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `goals`                 | Preset booleans plus `other` custom-string array                     | All false; empty `other`      |
| `household_people`      | Separate rows for everyone, including onboarding person              | Onboarding person only        |
| `meals_at_home`         | Free-text usual meal routine                                         | `Dinners.`                    |
| `main_supermarket`      | Free-text primary shop                                               | Empty string                  |
| `other_shops`           | Free text including access/effort/context                            | Empty string                  |
| `kitchen_equipment`     | Preset booleans plus `other` custom-string array                     | Oven/stove true; empty `other` |
| `pantry`                | Preset booleans plus `other` custom-string array                     | All true; empty `other`       |
| `fresh_ingredients`     | Preset booleans plus `other` custom-string array                     | All true; empty `other`       |

Name, diet, custom diet description, and restrictions entered in the opening wizard steps belong to the creator's household person, not duplicate top-level Profile fields. Goals, normal meals, shops, equipment, pantry, and fresh staples are household-wide. Ask normal meals in the household step.

Defaults are visible, editable starting selections. Do not silently switch pantry selections when diet changes. A selected broad category never overrides explicit dietary restrictions.

Each selection object uses stable preset keys with boolean values and an `other` string array, for example `{"save-time": true, "other": ["Feel comfortable cooking with my children"]}`. Missing preset keys mean false; missing `other` means empty. Meal routine is write-in, supporting descriptions such as "Weekday dinners, lunches and dinners on weekends." An absent routine defaults to "Dinners." Explicit empty text remains empty. No guest-state modeling is needed.

**Goal keys and labels**

| Key                    | Label                |
| ---------------------- | -------------------- |
| `eat-healthy`          | Eat healthy          |
| `cook-with-confidence` | Cook with confidence |
| `know-what-to-make`    | Know what to make    |
| `save-money`           | Save money           |
| `reduce-food-waste`    | Reduce food waste    |
| `save-time`            | Save time            |
| `explore-new-cuisines` | Explore new cuisines |

**Diet keys and presentation**

| Key           | Label       | Explanation                                      |
| ------------- | ----------- | ------------------------------------------------ |
| `flexitarian` | Flexitarian | More plants, less meat; still eats meat and fish |
| `omnivore`    | Omnivore    | I eat everything                                 |
| `meat-heavy`  | Meat heavy  | You love your proteins                           |
| `pescetarian` | Pescetarian | Vegetarian + seafood                             |
| `vegetarian`  | Vegetarian  | No meat or fish                                  |
| `vegan`       | Vegan       | No animal products at all                        |
| `other`       | Other diet  | User supplies description                        |

Choosing a standard diet clears stale custom-diet text. Choosing other requires a nonblank description before continuing.

**Restriction shortcuts:** Gluten-free, Dairy-free, Nut allergy, Low carb. Shortcuts add/remove their text in the free-text field while preserving other entered details. None clears it. Empty means no restrictions supplied; no separate allergy taxonomy or severity model is required.

**Household person**

| Field          | Meaning                                                       | Add-person default |
| -------------- | ------------------------------------------------------------- | ------------------ |
| `id`           | Stable person identifier; names are not identifiers           | Generated locally  |
| `userId`       | Optional linked User who is a member of this list             | Absent until creator is verified; other people remain unlinked |
| `name`         | Trimmed nonempty name                                         | Empty input        |
| `ageGroup`     | `Adult`, `Teen`, `Child`, `Toddler`, `Infant`                 | `Adult`            |
| `diet`         | Stable standard diet key, using same standard choices as cook | `flexitarian`      |
| `dietOther`    | Custom description when diet is `other`; required for creator's custom diet | Absent |
| `restrictions` | Free text                                                     | Empty string       |
| `mealTimes`    | Free-text usual attendance, e.g. weekday dinners and weekends | `Always`           |

Show the creator as a distinct read-only You entry in the household step, using their person record. Before authentication, the draft identifies that person by stable ID; afterward, derive You from the current User's link. The creator defaults to Adult; no age question for the creator is required. Edit their details through the opening wizard fields. Store and count them exactly once among the household people. Support multiple other people, including people sharing a name. Other-person diet choices remain the standard diets; the creator's custom diet is retained on their person record. Database fields use snake_case (`user_id`, `age_group`, `diet_other`, `meal_times`).

**Equipment keys:** `oven` (Oven), `stove` (Stove), `microwave` (Microwave), `air-fryer` (Air Fryer), `blender` (Blender), `slow-cooker` (Slow Cooker), `food-processor` (Food Processor), `rice-cooker` (Rice Cooker).

**Pantry categories**

| Key                   | UI label/examples                                            | Assistant category   |
| --------------------- | ------------------------------------------------------------ | -------------------- |
| `cannedFoods`         | Canned foods: tomatoes, beans, chickpeas, tuna, etc.         | Canned foods         |
| `dryFoods`            | Dry foods: pasta, rice, bulgur, tortillas, etc.              | Dry carb staples     |
| `seasonings`          | Seasonings: Asian pastes, sauces, salsa, mustard, mayo, etc. | Sauces & condiments  |
| `driedSpices`         | Dried spices and herbs                                       | Dried spices & herbs |
| `nutsAndDriedFruit`   | Nuts and dried fruit                                         | Nuts & dried fruit   |
| `specialtySeasonings` | Specialty seasonings — for creativity and riffing            | Specialty seasonings |

**Fresh categories**

| Key                          | UI label/examples                                                           | Assistant category                                    |
| ---------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `milkAndDairy`               | Milk & dairy products                                                       | Milk & dairy                                          |
| `eggs`                       | Eggs                                                                        | Eggs                                                  |
| `potatoesOnionsGarlicGinger` | Potatoes, sweet potatoes, onions, garlic, ginger                            | Aromatics & staples (onion, garlic, ginger, potatoes) |
| `freshVegAndHerbs`           | Fresh veg and herbs: broccoli, peppers, coriander, tomatoes, cucumber, etc. | Fresh vegetables & herbs                              |

Goals, equipment, pantry, and fresh categories each support adding/removing custom entries. Trim entries and do not append empty strings. Preserve meaningful free-text detail rather than summarizing it with AI.

### Draft persistence and native UX

- Persist cooking answers, current step, entered email, and stable draft/person identifiers locally as they change in a durable device-local draft store separate from PowerSync. This must work before account creation, without a backend account or anonymous session. Choose the concrete storage adapter during implementation; it must survive process restarts and hold the full draft.
- Restore after app restart. Backgrounding for email retrieval must preserve progress. A partially typed person editor may be discarded on process restart; already saved household members must survive.
- Verification code is transient: do not include it in persisted Profile or durable draft. Restore verification screen with code empty when needed.
- After authentication, associate pending finalization with the verified User and target list. A draft must not be applied automatically to a different User or list, or overwrite an existing Profile.
- Validate restored draft shape before use; invalid step must not strand navigation. Retain valid answers where possible.
- Use keyboard-aware layouts, safe areas, native text inputs, email keyboard, code paste/autofill where available, accessible control labels, and announced progress/errors. Keep primary navigation reachable on small screens and with larger text.
- Style should be warm, approachable, and easy to tap. Exact web layout, animation, radii, or fonts are not acceptance requirements.

### Authentication and Profile finalization

- Email entry validates a usable email format before requesting a code. Use six-digit email OTP for both signup completion and returning sign-in.
- Requesting code may create a pending auth record depending on provider. Product-level signup is complete only after verification and Profile persistence.
- Show sending/verifying/saving states and actionable errors. Prevent duplicate in-flight submissions. Auto-submit a complete six-digit code once; retain explicit Verify action for retry.
- Allow editing email and resending code under provider's resend rules. Changing email clears old code state. Wrong/expired code retains cooking draft and allows correction/resend.
- Finalization must be retry-safe across list, list membership, and Profile creation. Persist the chosen list/Profile identifiers with the pending draft and reuse them on retry; enforce one Profile per list. Commit related local writes atomically using PowerSync's normal write path. If verification succeeds but the local write fails, retry without consuming the same OTP again. If the app closes after the local commit but before draft cleanup, recognize the completed records and finish without creating duplicates. Use normal PowerSync upload/retry behavior after the local commit.
- After verification, load existing Profile first. If email belongs to a returning User with a Profile, load it and enter app; do not overwrite it with onboarding draft. Inform User that existing setup was loaded and discard abandoned draft after successful entry.
- Secondary Sign in must not create a new account merely by requesting a code for an unknown email. Use provider's existing-user behavior or equivalent, with a path back to Get started.
- If an existing authenticated User has no Profile, allow setup completion with current session. Existing-user status does not by itself imply onboarding completion.
- Persistence uses list-scoped PowerSync reads and writes, retry-safe initial creation, and updates to existing structured data. Distinguish a confirmed absence from incomplete initial sync or failed lookup. A successful Save means durable local persistence, not waiting for upload acknowledgement.

### Profile viewing and editing

- Display all cooking fields in readable sections: household people and their diets/restrictions, goals/normal meals, shops, equipment, pantry, fresh staples. Identify the current User's linked person as You.
- Reuse option keys and interpretation across onboarding and editing, but use a settings-style section editor rather than replaying wizard.
- Begin edits from saved values. Save persists section changes while preserving unrelated fields; Cancel leaves saved Profile untouched. Support removals and explicit empty values.
- Show saving/error states. Failed save retains edit draft and allows retry; do not close editor or claim success before persistence succeeds.
- Household add/edit/remove and custom entries remain available after signup.
- Each person's display name has one logical source of truth in their household person record. Do not add a duplicate top-level cook name or independently editable Profile title.
- Saved changes affect subsequent Cooking Assistant requests, including requests within an existing Conversation. Existing generated content is not rewritten automatically.

### Cooking Assistant context contract

Derive context on demand from saved structured Profile; do not store an independently editable/cached prompt as a second source of truth. Use destination project's existing assistant request boundary. This scope adds profile context, not a new Cooking Assistant implementation.

Use the Conversation's list-specific Profile, not a personal Profile selected by the caller. Identify the current User through their optional person link; do not infer a link from a name or add an unlinked caller to the serving count. Integrate profile edits with the existing PowerSync-to-assistant request path so subsequent requests use the edited data, accounting for pending uploads rather than assuming local saves have already reached the server.

Include all relevant cooking data, rather than a shortened summary: cook identity, diet/custom explanation, selected/custom goals, restrictions, every household member and their details, meals cooked at home, selected/custom equipment, shopping context, and selected/custom staple categories.

Interpretation rules:

1. Respect explicit dietary restrictions and allergies. Do not repeatedly ask for facts already present.
2. Flexitarian is plant-forward, welcomes meat-free meals, and still regularly eats meat and fish; it is not vegetarian.
3. All household people form the serving baseline, including the creator exactly once. Use attendance and current request to determine who is eating. A one-off request can change attendance or servings without changing saved Profile.
4. Interpret the free-text meal routine as stated, including weekday/weekend differences. Dinners is the new-wizard default, not a restriction on what the User may describe. The current request can override the usual routine.
5. Selected equipment and custom equipment are available. Do not assume an unlisted appliance; provide a feasible alternative or ask when necessary. All equipment false with no custom items means none declared, not an implicit stove/oven.
6. Pantry/fresh selections describe categories the cook tends to keep, not current inventory or a shopping list. Do not assert they currently have a specific ingredient just because its category is selected.
7. UI examples help Users recognize categories; pass clean category labels to assistant so examples do not repeatedly bias dish choices.
8. Shops and pantry habits inform sourcing/substitution, not a restriction on cuisines. Preserve practical notes such as a shop requiring extra effort.
9. Preferences, stocked categories, and default selections do not override explicit restrictions.
10. Keep User-entered text as profile data within target assistant's existing context format. No need to reproduce prototype's synthetic tool-call preamble or exact XML formatting.

## Testing Decisions

Test externally observable behavior, not widget structure, reducer internals, or exact prose formatting. Follow `docs/testing.md`. End-to-end flows below are a manual acceptance pass on native devices; this work does not introduce an automated native end-to-end harness. Add focused automated tests for meaningful draft restoration, retry-safe finalization, or wizard behavior where complexity warrants them. Choose a stable public boundary; do not introduce a wizard class or framework solely for testing. Keep a small deterministic Profile-to-context test boundary for interpretation rules.

### Manual acceptance: User flow → persisted list and Profile

1. Fresh launch shows primary Get started and secondary Sign in. Full wizard reaches email only after cooking setup; no auth dependency is needed before that point.
2. Complete flow with custom diet/goals/equipment/staples, restrictions, multiple household members, shop notes, and weekday/weekend meal differences. Verify saved data equals choices; email/code are not cooking fields.
3. Defaults-only cooking flow after entering name works. Solo cook is counted once; defaults are visible and removable.
4. Back/forward preserves changes; diet selection advances; None clears restrictions; nested person cancel does not append/update someone.
5. Restart mid-wizard and switch out for email: saved answers and step survive. Restart code screen restores no stored OTP.
6. Wrong/expired code and send failure retain draft. Editing email resets code; resend permits completion.
7. Successful verification followed by failed local save is recoverable without re-verifying. Repeated completion and restart after local commit still produce one list, creator membership, and Profile. Upload interruption uses normal PowerSync retry behavior.
8. Returning sign-in loads existing Profile without wizard. Existing email used at wizard end does not overwrite saved Profile. Unknown email on secondary Sign in has a Get started path.
9. Authenticated User without Profile can finish setup; Profile lookup failure shows retry instead of treating User as new.
10. Profile section save changes only intended data; Cancel and failed save preserve persisted state. Reload reflects successful edits.
11. List members can read/write the shared Profile; nonmembers cannot read/write or sync it. The creator is linked and counted once; other household people need no account. Draft from one authenticated finalization is not applied to another User or list.
12. Manually verify small-screen keyboard behavior, code paste/autofill, screen-reader labels/progress, and larger text on supported native platforms.

### Deterministic boundary: Profile → assistant context

- Cover selected and custom fields, all member details, empty optional fields, and absent normal-meals default.
- Assert flexitarian includes meat/fish, household excludes duplicate cook, free-text meal routine survives intact, and explicit no-equipment does not invent appliances.
- Assert category output uses clean category labels and states usual-stock semantics rather than current inventory. Shop notes and restrictions survive intact.
- Assert saved profile edits are read for next assistant request.
- Prefer semantic assertions over full prompt snapshots. These tests verify supplied context; they do not prove model obedience. A small manual assistant smoke check can confirm representative restricted-diet and limited-equipment requests.

### Prior art

Hobs has Vitest tests around its pure Profile-context builder, covering diet, restrictions, household, normal meals, equipment, custom options, and category rendering. Reuse those behavioral cases conceptually. Its wizard is a client-side stateful flow; do not assume it provides a portable mobile end-to-end harness. Use target project's test tooling rather than introducing Hobs' web test stack.

## Out of Scope

- Voice recording, transcription, voice-driven onboarding, and AI field extraction.
- Anonymous guest cooking, fridge-photo entry, and linking an email later to retain anonymous usage (guest account claiming).
- Automatic learning or modification of Profile from Conversations.
- Multiple Profiles per list, household invitations, UI for linking other accounts to household people, or new household-member authentication flows. The optional person-to-User link is included in the model, and onboarding links the creator.
- Pantry inventory tracking, quantities, expiry, shopping-list management, or meal-plan creation.
- Building/rebuilding Cooking Assistant, recipes, or other core cooking surfaces beyond connecting saved Profile context.
- Localization implementation (planned for later), recipe search-engine visibility, language settings screen, and unrelated account settings.
- Social/password authentication alternatives or a broader auth redesign.
- Migrating Hobs users/data, sharing Hobs backend, or implementing inside Hobs' own mobile workspace.
- Pixel-identical reproduction of web UI.

## Further Notes

### Confirmed product decisions

- Entire upfront wizard and email-code signup are included.
- First-launch Get started dominates; returning-user Sign in is deliberately secondary.
- All cooking-profile fields, later viewing/editing, and assistant-context rules are included.
- Voice and automatic conversational profile learning are excluded.
- Profile ownership is per list; the list represents the household. Onboarding creates a list when setting up a new household.
- Household people include the creator and may optionally link to list-member Users. Only the creator is linked in this scope; invitations are deferred.
- Pre-authentication drafts use separate durable local storage; authenticated persistence follows normal PowerSync behavior.
- Localization is planned but deferred. End-to-end acceptance is manual, with focused automated tests for meaningful logic.
- Deliverable is this Estra implementation spec.

### Reference findings and intentional implementation clarifications

- Current Hobs wizard has eleven steps and saves cooking payload after email OTP verification. It persists answers and numeric step in browser storage, then navigates to its cooking surface.
- Hobs enforces one Profile per User. Estra intentionally differs: one Profile per list, shared through list membership.
- Hobs shows cook separately and stores only other people in its household array. Estra intentionally stores everyone once in separate person rows and derives You through the current User's link. Use stable diet keys consistently.
- Current wizard persists its whole state, including OTP, and uses a simple final insert. This spec explicitly separates transient code from durable draft and requires recoverable finalization.
- Current prototype's email gate is weaker than its declared email schema. Mobile should apply usable email validation, not copy an at-sign-only check.
- Existing-account handling, resend, interrupted-save recovery, and authenticated-without-Profile routing are completion requirements clarified here to make confirmed end-to-end mobile flow reliable; they should not be assumed complete in prototype.
- Estra's existing stack and conventions apply. Concrete storage adapters and native presentation follow implementation needs. Localization is future work. Core data meanings, flow order, and acceptance behavior above are the implementation contract.
