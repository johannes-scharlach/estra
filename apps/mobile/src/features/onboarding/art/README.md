# Onboarding Artwork Style & Prompts

The onboarding and setup artwork uses a **Tactile Polymer Clay / Claymorphism** mascot and culinary illustration style. It features handcrafted, pillowy plasticine volumes, smooth matte textures with soft rounded edges, warm studio lighting from the top-left casting gentle shadows, and a solid flat background matching the app's light theme (`#FBF8F4` from `apps/mobile/src/global.css`).

## Style Formula

```text
[Subject description]. Matte polymer clay art style, smooth plasticine with soft rounded edges, pillowy volume, cute handmade tactile feel, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4. No text, words, labels, or lettering.
```

### Generation Settings & Transparent Asset Workflow

All tile and welcome assets rendered in the UI require a **transparent background** (alpha channel) so they composite natively over cards and dynamic backgrounds in both light and dark themes.

#### Pipeline

1. **Subagent Generation**:
   Prompt the `image-generator` subagent with a solid chroma blue background:
   `Solid flat uniform bright chroma blue background (#0047FF), completely plain and seamless with no gradients, no texture, no shadows on the background, and no ground plane.`
   - **Important**: Subjects must NOT contain blue tones (e.g. use cream, white, or charcoal for air fryers/appliances) so chroma extraction doesn't clip the subject.
   - **Margins**: Always enforce 15% clear margin on all sides.
   - **Aspect Ratio**: `1:1` for tile items; `3:2` for `welcome-market-find`.

2. **Chroma Key Post-Processing**:
   Run the project keying script to extract a transparent feathered PNG:
   ```bash
   node scripts/chroma-key.js <generated_image.jpg> apps/mobile/src/features/onboarding/art/<id>.png
   ```
   The script performs:
   - Soft alpha feathering between edge tolerance boundaries (`diff = b - max(r, g)`).
   - Color despill clamping residual blue reflections on boundary pixels.

3. **Wiring Into App**:
   Register newly delivered assets in `apps/mobile/src/features/onboarding/artwork.tsx` inside `deliveredAssets`:
   ```ts
   "<id>": require("./art/<id>.png"),
   ```


---

## Production handoff — onboarding redesign

The UI deliberately renders named placeholders until the artwork is delivered.
Each heading below is the **exact ID shown in the placeholder**. Export as
`<id>.png`; wire the resulting asset into `../artwork.tsx`, keeping its ID.
No image generation is part of this implementation. Native checkmarks, arrows,
menus, and close controls remain system symbols, not commissioned artwork.

### Shared delivery requirements

- Tile assets: **1:1, 1024×1024 PNG**. Single isolated subject, consistent
  three-quarter view, same apparent object scale. Keep 15% clear space on all
  sides. The UI fits these into a roughly 1.35:1 space without cropping the subject.
- Welcome: **3:2, 1536×1024 PNG**. This is the only large onboarding scene.
- Match the existing clay mascot reference and palette. Background #FBF8F4.
- No baked-in text, labels, selection marks, borders, or sparkle effects.
  Ingredient names, controls, and selected states belong to the app.
- Each prompt below is complete and can be handed to the generator as-is.
- Signup and saving reuse the selected ingredient/equipment assets in a small
  composition. Do not commission a separate email illustration or summary card.
- Equipment, pantry, and fresh screens have **no decorative header image**.

### welcome-market-find

Placement: welcome hero. Show a real reason to change a meal: finding something
appealing while shopping. Keep the composition readable at phone width.

> A clay magpie has found a beautiful purple aubergine at a small food market and is lifting it into its shopping basket with obvious interest. The basket already contains tomatoes and a packet of pasta, suggesting a meal that can accommodate the new find. One simple market crate, no busy shop interior. Wide 3:2 composition with the bird and aubergine as the focal point, generous space around them. Match the provided Magpie mascot reference. Matte polymer clay, soft rounded handmade forms, soft top-left studio lighting and gentle shadows, flat background #FBF8F4. No text, lettering, labels, borders, checkmarks, or sparkles.

## Goal tiles

Food illustrates the choice, rather than adding a generic icon above it.

### goal-cook-with-what-you-have

> A small clay bowl of chickpea and tomato stew beside a half-full jar of chickpeas and one tomato, a recognisable meal made from a few ingredients. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-fast-weeknight-dinners

> One small clay frying pan containing noodles, peas and a fried egg, a simple appealing quick dinner, handle visible. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-explore-new-cuisines

> Three clay dumplings in an open small bamboo steamer with a tiny dipping bowl, distinct recognisable shapes, appetising and approachable. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-use-up-what-you-buy

> An open small clay food container holding roast vegetables beside a tortilla folded around some of those same vegetables, showing yesterday's food becoming another meal. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-fresh-healthy-meals

> A small clay plate of colourful roasted carrots, greens, grains and white beans, a satisfying everyday meal rather than a diet symbol. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-cook-on-a-budget

> A small clay bowl of red lentil dal with rice and a few dry lentils beside it, generous simple food from inexpensive ingredients. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No money symbols, text, labels, lettering, borders, checkmarks, sparkles, or mascot.

### goal-cook-with-confidence

> A small clay chopping board with a knife, three neatly sliced carrot rounds and the remaining carrot, a clear manageable cooking action. Isolated compact square composition, 15% clear margin. Matte polymer clay, soft rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No text, labels, lettering, borders, checkmarks, sparkles, or mascot.

## Equipment tiles

### equipment-oven

> A single freestanding clay oven, front three-quarter view, closed glass door with one empty rack visible and simple unmarked control knobs. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-stove

> A single compact clay two-burner stovetop, three-quarter view from slightly above, recognisable burner rings and simple unmarked knobs, no oven underneath. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No cookware, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-microwave

> A single compact clay microwave with a closed dark window, side control knob and recognisable handle, front three-quarter view. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-air-fryer

> A single compact clay air fryer with a rounded body and clearly visible pull-out basket handle, front three-quarter view. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-blender

> A single clay countertop blender, tall clear jug with lid and handle on a small motor base, front three-quarter view. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-slow-cooker

> A single clay oval electric slow cooker with a glass lid, two side handles and a small unmarked front dial, front three-quarter view. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-food-processor

> A single clay food processor with a broad low clear bowl, central blade column and lid feed tube on a motor base, distinct from a tall blender, front three-quarter view. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

### equipment-rice-cooker

> A single rounded clay electric rice cooker with a hinged lid and small front switch, front three-quarter view, recognisably different from an oval slow cooker. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, top-left studio light, gentle shadows, flat background #FBF8F4. No food, kitchen scene, mascot, text, numbers, lettering, labels, or selection marks.

## Pantry tiles

### pantry-pasta

> A small open glass jar of dry clay penne pasta with three penne pieces beside it, clearly uncooked. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-rice

> A small open glass jar of dry white clay rice with a tiny mound of rice beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-canned-tomatoes

> An open small clay tin of chopped red tomatoes, a single raised tomato motif on the otherwise plain tin, contents clearly visible. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-canned-corn

> An open small clay tin full of bright yellow sweetcorn kernels, a few kernels beside it, contents clearly visible. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-chickpeas

> An open small clay tin of beige chickpeas with three chickpeas beside it, their characteristic pointed shapes visible. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-olive-oil

> A small dark green clay olive-oil bottle with a pour spout and two green olives beside it, no other objects. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-lentils

> A small open glass jar of dry orange-red clay lentils with a little mound beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-canned-beans

> An open small clay tin of red kidney beans with three recognisable kidney-shaped beans beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-soy-sauce

> A small clay soy-sauce bottle containing very dark brown liquid, red pour cap, and a tiny shallow dish with one dark drop beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No brand marks, mascot, text, lettering, labels, borders, or selection marks.

### pantry-oats

> A small open glass jar of pale beige rolled clay oat flakes, a few flat flakes beside it, clearly distinct from rice. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-flour

> A small folded-open plain paper bag holding white clay flour with a little wooden scoop of flour beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### pantry-coconut-milk

> An open small clay tin containing white coconut milk with a half coconut beside it, visible white flesh and brown shell. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

## Fresh-food tiles

### fresh-eggs

> Three clay eggs in a small open cardboard egg carton, warm natural shell colours, no broken eggs. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-milk

> A small clear clay glass milk bottle filled with white milk, simple pale blue cap, no other objects. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-greek-yoghurt

> A small blue clay yoghurt tub with its foil peeled back and a spoon holding a thick mound of white Greek yoghurt that keeps its shape. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No fruit, mascot, text, lettering, labels, borders, or selection marks.

### fresh-plain-yoghurt

> A small pale green clay yoghurt tub with its foil peeled back and a spoon trailing smooth runny white plain yoghurt, clearly softer than thick Greek yoghurt. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No fruit, mascot, text, lettering, labels, borders, or selection marks.

### fresh-onions

> One whole golden-brown clay onion and one cut half with visible concentric rings, no other ingredients. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-carrots

> Two orange clay carrots with short green tops, one resting diagonally across the other, no other ingredients. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-garlic

> One whole ivory clay garlic bulb and two peeled garlic cloves beside it, no other ingredients. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-lemons

> One whole yellow clay lemon with a small green leaf and one cut lemon half showing its segments, no other ingredients. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-cream

> A small plain cream-coloured clay carton with an open pouring spout and a tiny jug of pourable pale cream beside it. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-sour-cream

> A small pale orange clay sour-cream tub with its foil peeled back, showing a soft white dollop with a gently curled peak. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-broccoli

> A single fresh green clay broccoli head with a short stalk and a few clearly modelled rounded florets, no other ingredients. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

### fresh-chinese-cabbage

> One elongated clay Chinese cabbage with pale white ribs and crinkled light green leaves, one outer leaf slightly open, recognisably napa cabbage rather than a round cabbage. Isolated square composition, 15% clear margin. Matte polymer clay, rounded handmade forms, front three-quarter view, top-left studio light, gentle shadows, flat background #FBF8F4. No mascot, text, lettering, labels, borders, or selection marks.

## Existing assets

`art-welcome.png` remains in use on the app's startup screen. The old diet,
kitchen, pantry, and fresh banner files are retained but are no longer used by
the onboarding questions. They are not on the production request list.

## Original asset prompts (reference only)

### `art-welcome.png`

- **Subject**: Clay Magpie mascot perched beside bowl of white beans, vine tomatoes, basil, and spoon
- **Prompt**:
  > Clay Magpie mascot perched happily beside a wooden bowl filled with white beans, ripe red cherry tomatoes on the vine, and fresh green basil leaves with a spoon. Same matte polymer clay art style, smooth plasticine, rounded edges, soft studio lighting from top-left, solid flat background with exact color #FBF8F4 as reference image. No text or lettering.

### `art-diet.png`

- **Subject**: Plump clay plate with grilled salmon fillet, salad leaves, and cherry tomatoes
- **Prompt**:
  > Plump clay ceramic plate viewed from above containing a tender grilled salmon fillet with grill marks, vibrant green salad leaves, and red cherry tomatoes. Same matte polymer clay art style, smooth plasticine, pillowy volumes, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4 as reference image. No text or lettering.

### `art-kitchen.png`

- **Subject**: Red enameled Dutch oven casserole pot on burner with steam puffs and wooden spoon
- **Prompt**:
  > Red enameled dutch oven casserole pot with lid on a stovetop burner base, with gentle stylized clay rising steam puffs and a wooden spoon beside it. Same matte polymer clay art style, smooth plasticine with soft rounded edges, pillowy volume, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4 as reference image. No text or lettering.

### `art-pantry.png`

- **Subject**: Rounded glass jar of white beans, jar of penne pasta, tomato tin can, olive oil bottle
- **Prompt**:
  > Kitchen pantry items: a rounded clear glass jar filled with clay white beans, a glass jar filled with penne pasta, a small tin can with a sculpted red tomato motif, and an olive oil bottle. Same matte polymer clay art style, smooth plasticine with soft rounded edges, pillowy volume, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4 as reference image. No text or lettering.

### `art-fresh.png`

- **Subject**: Vine cherry tomatoes, fresh basil leaves, yellow onion, and garlic bulb
- **Prompt**:
  > Fresh culinary ingredients: ripe red cherry tomatoes on the vine, vibrant green basil leaves, a plump yellow onion, and a whole garlic bulb. Same matte polymer clay art style, smooth plasticine with soft rounded edges, pillowy volume, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4 as reference image. No text or lettering.
