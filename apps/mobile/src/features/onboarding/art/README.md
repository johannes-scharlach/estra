# Onboarding Artwork Style & Prompts

The onboarding and setup artwork uses a **Tactile Polymer Clay / Claymation** mascot and culinary illustration style (inspired by stop-motion clay animation like Aardman, Wallace & Gromit). It features handcrafted, pillowy plasticine volumes, smooth matte textures with soft rounded edges, and warm studio lighting from the top-left. The warm palette complements the app's light theme (`#FBF8F4` from `apps/mobile/src/global.css`); generation backdrops are temporary and must be removed, not shipped.

## Mascot Character Reference (Magpie)

Whenever generating an image containing the Magpie mascot, always reference the official app logo and reference artwork:

- **Logo Icon**: `apps/mobile/assets/images/icon.png`
- **Reference Scene**: `apps/mobile/src/features/onboarding/art/art-welcome.png`

### Mascot Anatomical Requirements

- **Style**: Stop-motion **claymation** character, NOT a realistic bird and NOT digital claymorphism.
- **Eyes**: Large, prominent, expressive round white cartoon eyes positioned close together on the front of the face, with circular black pupils looking curious and friendly, plus subtle curved dark clay eyebrows. Strictly **never** small, beady, or realistic bird eyes.
- **Beak**: Short, friendly, curved dark-grey matte clay beak with a gentle cheerful smile line at the corners. Strictly **never** a long, sharp crow/raven beak.
- **Body & Plumage**: Plump, rounded, handcrafted matte black plasticine head, back, and wings; clean white plasticine belly, chest, and wing flash. Pillowy volume with delicate handmade thumbprints and clay-modeling textures.
- **Legs & Feet**: Chunky dark-grey matte clay legs with three stubby rounded toes in front and one behind.

## Style Formula

```text
[Subject description]. Handcrafted stop-motion claymation art style, matte polymer plasticine with soft rounded edges, pillowy volume, cute tactile handmade feel, soft studio lighting from top-left with gentle shadows, solid flat background with exact color #FBF8F4. No text, words, labels, or lettering.
```

### Generation Settings & Transparent Asset Workflow

All tile and welcome assets rendered in the UI require a **transparent background** (alpha channel) so they composite natively over cards and dynamic backgrounds in both light and dark themes.

AI source renders are opaque. Keep those untouched originals separately from
the transparent PNG masters. Both script modes require a **new output path**
and reject inputs that already contain transparency. Never re-key a master.
Neutral-grey matting is an **opt-in experiment**, not a new production default;
see the trial below before changing prompts or replacing assets.

#### Pipeline

1. **Subagent Generation**:
   Prompt the `image-generator` subagent with a solid chroma blue background:
   `Solid flat uniform bright chroma blue background (#0047FF), completely plain and seamless with no gradients, no texture, no shadows on the background, and no ground plane.`
   - **Important**: Subjects must NOT contain blue tones (e.g. use cream, white, or charcoal for air fryers/appliances) so chroma extraction doesn't clip the subject.
   - **Margins**: Always enforce 15% clear margin on all sides.
   - **Aspect Ratio**: `1:1` for tile items; `3:2` for `welcome-market-find`.
   - Replace the background clause in the subject prompt with the chosen
     backdrop instruction; do not ask for theme cream and chroma blue together.

2. **Chroma Key Post-Processing**:
   Run the project keying script to extract a transparent feathered PNG:

   ```bash
   node scripts/chroma-key.js <generated_image.jpg> apps/mobile/src/features/onboarding/art/<id>.png
   ```

   The script performs:
   - Soft alpha feathering between edge tolerance boundaries (`diff = b - max(r, g)`).
   - Color despill clamping residual blue reflections on boundary pixels.
   - Transparent margin autocropping to tight bounding box with 16px padding.

   **Known limitation:** this legacy keyer can leave cyan/grey fringes and
   contaminate translucent glass. Making blue pixels transparent and clamping
   their blue channel does not reconstruct clean foreground edge colours. Keep
   the untouched generated image for comparison. Changing the screen colour
   alone does not solve this. The experimental mode below uses foreground
   matting and colour estimation instead. Both modes decode with Sharp, without
   the old macOS `sips` step or temporary conversion file. Check results over
   both light and dark backgrounds before accepting a master.

3. **Optimize for the app**:
   From the repo root, run:

   ```bash
   pnpm assets:optimize
   ```

   This reads the PNG masters in this folder and writes WebP files into
   `optimized/`. It prints dimensions and per-file/total size savings. It never
   changes the masters or deletes files; identical exports are not rewritten.
   It preserves the supplied transparency, but does not repair keying fringes.

   Settings live at the top of `scripts/optimize-onboarding-art.mjs`:
   - Tiles: at most **512 px on the longest edge**.
   - `welcome-*.png` and startup `art-welcome.png`: at most **1024 px**.
   - WebP quality **82**, with lossless alpha encoding. No background flattening.
   - Preserve aspect ratio, without cropping or upscaling. Strip source metadata.
   - Skip the retired `art-diet`, `art-kitchen`, `art-pantry`, and `art-fresh` banners.

   Review texture and transparent edges on light/dark backgrounds, including
   tablet and large-text layouts, before lowering dimensions or quality further.
   Track the WebP exports alongside their PNG masters so fresh checkouts can
   build without running the processor. This is an explicit asset-authoring
   command, not a dev/build hook. Sharp is a root dev dependency, not a mobile
   runtime dependency. Run its real-image command tests with `pnpm assets:test`.

   To try another folder without touching the normal exports:

   ```bash
   pnpm assets:optimize --input /path/to/png-masters --output /path/to/webp-exports
   ```

   The same filename-based tile/hero settings and retired-banner exclusions apply.

4. **Wiring Into App**:
   Register newly delivered assets in `apps/mobile/src/features/onboarding/artwork.tsx` inside `deliveredAssets`:
   ```ts
   "<id>": require("./art/optimized/<id>.webp"),
   ```

---

## Neutral-grey matting experiment — not production

Question: can neutral-grey AI renders plus foreground matting produce cleaner
cutouts than the current blue-screen keyer, especially around glass?

Start with **equipment-oven** and **pantry-pasta**. Do not regenerate the full
set, overwrite masters, or change app imports for this trial.

### Generate trial sources

Use the same subject briefs, framing, warm lighting, and reference artwork as
above. Keep a blue-background original for the baseline. For the grey variant,
**replace** the whole background clause (including any `#FBF8F4` or `#0047FF`)
with:

> Solid flat uniform neutral mid-grey background, exact colour #808080. Completely plain and seamless, no gradients, texture, cast shadows on the background, or ground plane. Neutral studio lighting on the subject, no coloured rim lighting or background-coloured reflections. Preserve the subject's own colours; grey applies only to the backdrop.

Keep 15% clear margins. Do not ask the generator to paint a transparency
checkerboard. Grey is not chroma-keyed away: a foreground model supplies the
mask, so blue/grey subject details are not deliberately excluded by colour.
Glass and translucent contents remain hard cases that need visual acceptance.

### Run the opt-in processor

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) if needed.
The flag runs `scripts/experimental-art-matting.py` in an isolated uv environment
with Python 3.12 and pinned `rembg[cpu]` 2.0.85. The first run installs local
dependencies (and Python if absent); the first **automatic-mask** run downloads
the `isnet-general-use` model, about 170 MiB, cached under `~/.u2net/` by default.
Images stay local. None of these dependencies or model files ship in the app.

The automatic path estimates a foreground mask, refines soft alpha with
closed-form matting, then estimates foreground colours to remove background
contamination. It fails rather than silently falling back to a mask-only
cutout. It crops with 16px padding, just like the legacy path.

Use the gitignored folder below. The WebP optimizer does not scan it:

```bash
mkdir -p apps/mobile/src/features/onboarding/art/experiments/neutral-matting

# Baseline: original blue render through the legacy keyer.
node scripts/chroma-key.js /path/to/oven-blue-original.jpg apps/mobile/src/features/onboarding/art/experiments/neutral-matting/oven-blue-key.png

# Same source through matting: isolate the processor change.
node scripts/chroma-key.js /path/to/oven-blue-original.jpg apps/mobile/src/features/onboarding/art/experiments/neutral-matting/oven-blue-matted.png --experimental-matting

# Grey source through matting: trial the proposed generation workflow.
node scripts/chroma-key.js /path/to/oven-grey-original.jpg apps/mobile/src/features/onboarding/art/experiments/neutral-matting/oven-grey-matted.png --experimental-matting
```

Repeat for the pasta jar. Each output path must be unused; choose a new filename
when adjusting an experiment. The normal two-argument command remains the
legacy blue-screen mode. No matting runs during development or app builds.

To separate colour cleanup from model selection, supply an authored **alpha
mask**, matching the source's oriented dimensions. White means opaque, black
transparent, and grey partial coverage. The script uses that exact coverage
and estimates foreground colours; it does not re-estimate alpha or download
model weights on this path:

```bash
node scripts/chroma-key.js /path/to/original.jpg apps/mobile/src/features/onboarding/art/experiments/neutral-matting/mask-assisted.png --experimental-matting --mask /path/to/alpha-mask.png
pnpm assets:matting:test
```

Those command tests use known synthetic renders/masks to check edge-colour
recovery, cropping, source preservation, and refusal to overwrite files or
reprocess transparent masters. They **do not** validate model selection on
real clay artwork. Routine `pnpm assets:test` stays Node-only.

### Acceptance before promotion

- Composite each result over theme cream `#FBF8F4` and dark grey `#242424`.
  Check at actual tile size and zoomed in, including tablet layouts.
- No blue/cyan rim, neutral halo, jagged edge, or lost fine details.
- Preserve subject colours, jar outlines, contents, and intentional holes.
- Compare the blue-keyed and blue-matted pair before attributing an improvement
  to grey. Record failures as well as improvements; AI rerenders can differ.
- If these two subjects pass, agree on the workflow before replacing any
  production master. Only approved masters enter `pnpm assets:optimize`.

Current PNG/WebP assets are unchanged by this experiment. Old keyed PNGs cannot
reliably recover original edge colours; use their untouched source renders.

---

## Production handoff — onboarding redesign

The UI deliberately renders named placeholders until the artwork is delivered.
Each heading below is the **exact ID shown in the placeholder**. Export as
`<id>.png` as the master; run `pnpm assets:optimize` and wire
`optimized/<id>.webp` into `../artwork.tsx`, keeping its ID.
No image generation is part of this implementation. Native checkmarks, arrows,
menus, and close controls remain system symbols, not commissioned artwork.

### Shared delivery requirements

- Tile assets: **1:1, 1024×1024 PNG**. Single isolated subject, consistent
  three-quarter view, same apparent object scale. Keep 15% clear space on all
  sides. The UI fits these into a roughly 1.35:1 space without cropping the subject.
- Welcome: **3:2, 1536×1024 PNG**. This is the only large onboarding scene.
- Match the existing clay mascot reference (`apps/mobile/assets/images/icon.png`) and palette. Background #FBF8F4.
- No baked-in text, labels, selection marks, borders, or sparkle effects.
  Ingredient names, controls, and selected states belong to the app.
- Each prompt below is complete and can be handed to the generator as-is.
- Signup and saving reuse the selected ingredient/equipment assets in a small
  composition. Do not commission a separate email illustration or summary card.
- Equipment, pantry, and fresh screens have **no decorative header image**.

### welcome-market-find

Placement: welcome hero. Show a real reason to change a meal: finding something
appealing while shopping. Keep the composition readable at phone width.

> A friendly stop-motion claymation magpie mascot matching the character from `apps/mobile/assets/images/icon.png` (plump black-and-white plasticine body, large expressive round white cartoon eyes with black pupils, friendly curved short dark-grey beak, chunky dark grey clay feet) has found a beautiful purple clay aubergine at a small food market and is lifting it into its woven clay shopping basket with obvious delight. The basket already contains clay tomatoes and a packet of pasta, suggesting a meal that can accommodate the new find. One simple rustic wooden clay crate beside it, no busy background. Wide 3:2 composition with the claymation bird and aubergine as the focal point, generous 15% margin around them. Handcrafted matte polymer clay, soft rounded handmade forms, soft top-left studio lighting and gentle shadows, flat background #FBF8F4 (or chroma blue #0047FF for keying). Strictly no small beady realistic bird eyes, no sharp long crow beak, no text, lettering, labels, borders, checkmarks, or sparkles.

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

`art-welcome.png` is the master for the startup screen's
`optimized/art-welcome.webp`. The old diet, kitchen, pantry, and fresh banner
files are retained as references, but are neither exported nor imported into
the app. They are not on the production request list. Only generated WebP files
are referenced by runtime code; PNG masters do not enter Metro's asset graph.

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
