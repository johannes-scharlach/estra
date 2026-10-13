# Shopping categories follow-up

Status: Implemented.

Implemented the 16-category store-topology taxonomy, non-blocking background
auto-categorisation via Gemini Flash-Lite in apps/api (/v1/items/categorize), and
native category selection via MenuView in the mobile item sheet.

Revisit category names and grouping using the user's Bring screenshot as a reference:

- Fruits & Vegetables
- Bread & Pastries
- Milk & Cheese
- Meat & Fish
- Ingredients & Spices
- Frozen & Convenience
- Grain Products
- Snacks & Sweets
- Beverages
- Household
- Care & Health
- Pet Supplies
- Home & Garden
- Own Items

These are reference categories, not an approved replacement taxonomy.

Also investigate automatic categorisation that does not block adding an item.
The user suggested a lightweight model such as Gemini Flash-Lite; model choice
and implementation remain open. Inspect existing categorisation before choosing
an approach. Read docs/schema-changes.md before changing schema or sync rules.

Bring also exposes category visibility and ordering. These are visible in the
reference, not requested scope.
