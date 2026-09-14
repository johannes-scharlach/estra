import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { env } from "../env.js";
import { AppError } from "../errors.js";
import { CATEGORIES } from "../recipe-schema.js";

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

const CategorizeSchema = z.object({
  name: z.string().min(1),
});

const ResultSchema = z.object({
  categoryId: z.enum(CATEGORIES),
});

export const items = new Hono<AppBindings>();

const md = String.raw;

const CATEGORIZE_SYSTEM_PROMPT = md`
You are a supermarket aisle classifier. Classify the given grocery item name into exactly ONE of the following 16 store-topology categories:

- produce: Fresh fruits, vegetables, salad greens, fresh herbs, fresh garlic, potatoes, onions.
- bakery: Fresh bread, rolls, buns, bagels, croissants, toast bread, fresh pastries, baguettes.
- deli: Cold cuts (salami, ham, prosciutto, bacon), ALL cheeses (sliced cheese, Gouda, cheddar, mozzarella balls, parmesan wedges, feta, halloumi, blue cheese, goat cheese, shredded cheese), chilled deli salads (herring salad, potato salad, hummus, dips), fresh refrigerated pasta (tortellini, gnocchi), refrigerated doughs (pizza dough, puff pastry), tofu, seitan, smoked salmon, pickled herring.
- dairy: Chilled white/tub/carton dairy and plant alternatives: milk, oat drink, soy milk, butter, margarine, yogurt, quark, kefir, skyr, protein pudding, yfood / meal drinks, cooking creams (Sahne, Schmand, sour cream, crème fraîche, mascarpone, ricotta, cottage cheese).
- meat: Raw butchery and fresh fish: raw chicken breast, raw poultry, minced beef, pork chops, raw steaks, raw fresh fish fillets, raw shrimp/seafood.
- breakfast: Hot drinks and morning dry goods: coffee beans, ground coffee, decaf coffee, tea bags, loose-leaf tea, cereal, muesli, granola, porridge oats, sweet spreads (Nutella, jam, marmalade, honey, peanut butter, maple syrup).
- grains: Dry pantry carbs: dry pasta, noodles (spaghetti, penne, glass noodles, rice noodles), rice (basmati, jasmine, risotto), couscous, bulgur, polenta, flour, breadcrumbs, panko.
- spices: Cooking ingredients, canned staples, baking, oils & condiments: cooking oils (olive, sunflower, sesame), vinegars, salt, black pepper, spices, herbs, seasonings, stock cubes, sauces (soy sauce, teriyaki, hot sauce, mustard, ketchup, mayo), canned staples (canned tomatoes, passata, tomato paste, canned chickpeas, beans, lentils, coconut milk), jarred pickles, capers, olives, baking essentials (yeast, natron, baking powder, vanilla sugar, baking cocoa), baking nuts, seeds (chia, flax, pumpkin seeds), dried fruits (raisins, dates).
- snacks: Crisps, potato chips, tortilla chips, pretzels, chocolate bars, candy, gummy bears, cookies, biscuits, snack nuts.
- frozen: Freezer foods (frozen spinach, frozen berries, frozen pizza, ice cream, frozen vegetables) and shelf-stable instant ready-meals (canned ravioli, instant ramen, instant soups).
- beverages: Bottled and canned drinks: bottled water, sparkling water, sodas (Fanta, Cola), fruit juices, lemonade, beer, wine, cider.
- care: Personal hygiene, pharmacy, drugstore: toothpaste, toothbrush, dental floss, shampoo, body wash, deodorant, cotton buds, band-aids, effervescent vitamin tablets.
- household: Cleaning and utility: dish soap, dishwasher tabs/salt, sponges, surface spray, laundry detergent, trash bags, paper towels, toilet paper, foil, baking paper, freezer bags, descaler, shoe polish, coffee filters.
- pets: Pet food (dog food, cat food), pet treats, cat litter.
- home: Plants, flowers, potting soil, light bulbs, batteries, hardware.
- other: Miscellaneous catch-all for items not matching any store aisle above.

Pick the most specific and physically accurate supermarket section. Ignore brand names if obvious (e.g. "Nutella" -> breakfast, "yfood" -> dairy, "Fanta" -> beverages, "Salami" -> deli, "Canned ravioli" -> frozen, "Coffee beans" -> breakfast).
`;

items.post("/categorize", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CategorizeSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("INVALID_REQUEST", "Item name is required.", 400);
  }

  const { name } = parsed.data;

  try {
    const result = await generateText({
      model: google("gemini-flash-lite-latest"),
      output: Output.object({
        schema: ResultSchema,
      }),
      prompt: `${CATEGORIZE_SYSTEM_PROMPT}\n\nItem name: "${name}"\nClassify this item into one categoryId.`,
    });

    const output = result.output;
    if (!output?.categoryId) {
      return c.json({ categoryId: "other" });
    }

    return c.json({ categoryId: output.categoryId });
  } catch (error) {
    console.error("Failed to categorize item:", error);
    // Graceful fallback to other rather than failing the client request
    return c.json({ categoryId: "other" });
  }
});
