# Menu image provenance

The menu now uses the corresponding product photographs from [Andy’s Pizza Moldova](https://andys.md/) for all **216 selected source category entries**. These entries become **195 selectable source dishes** after identical category aliases are consolidated. The eight distinct original TableKind dishes retain their original illustrative photographs. Existing dinner records, product IDs, prices and receipts remain unchanged.

## Corresponding product photography

The catalog reference was observed on 12 October 2026. Its product image URLs were retrieved on **13 October 2026**, from `https://back.andys.md/image/cachewebp/catalog/andys/`. Each photo is matched by the selected source category, source product name and portion; images are not guessed from similarly named dishes.

- **195 source image URLs and local WebP files**, representing **189 distinct encoded photographs**. The source intentionally reuses six identical photo pairs for recipe or portion variants. Those variants retain their own names, portions and prices.
- Every prepared source image is **600 × 600 pixels**, at most **128,714 bytes**. The total source photo payload is **13,679,366 bytes**; the application loads photos as needed instead of downloading the entire catalog on entry.
- Preparation preserves the source composition and background, with WebP recompression at quality 84 and method 6. No generated replacement, ingredient editing, logo removal or recipe retouching was performed.
- All files are served locally under `/menu/dish-*.webp`. Visitors do not request photos from the restaurant’s server.
- [Machine-readable provenance](MENU-PHOTOS.json) records each fixture entry’s source name, category and portion, its local photo path, original URL, dimensions, bytes and SHA-256 digest. Copyright remains with the photo owners; source attribution does not establish a reuse licence. No independent reuse licence has been verified.
- Older demo dinners resolve a new photograph only when the full seeded name, price, description and original image path match. Category suffix aliases are accepted. Unrelated restaurant photos, customised recipes and original order snapshots retain their own paths.

The source uses the same photo for each of these pairs: garlic/plain sheep-cheese flatbread; 330 ml/1 L lemonade; 330 ml/1 L orangeade; 350 ml/1 L rosé sangria; 350 g/700 g ice-cream assortment; and banana-pineapple/whipped-cream ice cream. Matching the source product photo does not imply an exact illustration of serving size.

## Original TableKind illustrations

Garden pizza, Burger, Crispy chicken, Pasta, Shared starter, Tomato bruschetta, Salad and Citrus lemonade keep their original illustrative photos. They represent the written demo recipes, not an operating restaurant’s food. The earlier **27** category illustrations remain available for compatibility with existing stored menus; they are no longer used as generic substitutes for the selected source dishes.

The rest of this document records the original twelve illustrations; [eight additional food images](MENU-ASSETS-EXPANSION.md) and [seven drink and sauce images](MENU-ASSETS-DRINKS.md) complete that earlier set.

## Original illustration creation and preparation

- Tool: the built-in image generation tool, with one distinct generation request per dish and no reference images.
- The project’s paid API key was not used for these assets.
- Each output was visually inspected for the requested dish, consistent warm ivory ceramics and pale stone setting, readable ingredients, and absence of lettering or logos.
- Delivery: 800 × 800 pixel RGB WebP files. Pillow was used only for proportional downscaling and format compression; the compositions were not edited. WebP quality is 82, except Margherita and Garden Pizza at 79 and Pepperoni at 76. Each file is below 150,000 bytes.
- Original generated PNG outputs remain in the image tool’s local output storage. The application uses the project copies below, with no remote image requests.

## Final prompt set

### `burger.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: a photorealistic appetizing beef cheeseburger with melted cheddar, crisp lettuce, red tomato and a glossy sesame brioche bun. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate and burger centered, dish occupies about 75% of the frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `pasta.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing creamy mushroom tagliatelle with sautéed brown mushrooms, lightly grated parmesan and a small parsley garnish. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `salad.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing Greek salad of red tomatoes, cucumber chunks, black olives, red onion and generous white feta cubes. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `starter.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a sharing portion of six golden breaded mozzarella sticks, one broken open showing soft melted cheese, beside a small ivory ramekin of tomato dipping sauce. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `margherita.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a whole round wood-fired Margherita pizza with tomato sauce, melted white mozzarella islands, fresh basil leaves and airy golden blistered crust. Scene: one large warm ivory ceramic platter on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: high overhead camera angle, entire pizza visible and centered, pizza occupies about 80% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `pepperoni.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a whole round pepperoni pizza with generous red pepperoni rounds on golden bubbling mozzarella and tomato sauce, airy golden blistered crust. Scene: one large warm ivory ceramic platter on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: high overhead camera angle, entire pizza visible and centered, pizza occupies about 80% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `garden-pizza.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a whole round vegetarian pizza with mushrooms, colorful red and yellow bell peppers, black olive slices, tomato sauce and mozzarella, airy golden blistered crust. Scene: one large warm ivory ceramic platter on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: high overhead camera angle, entire pizza visible and centered, pizza occupies about 80% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `crispy-chicken.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing golden crispy breaded chicken strips with a generous side of thin golden French fries and a small ivory ramekin of creamy dipping sauce. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `bruschetta.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing three slices of toasted rustic baguette generously topped with diced red tomatoes, fresh basil and a light drizzle of olive oil. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `tiramisu.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a neat rectangular single portion of tiramisu, cocoa dusted mascarpone top with visible alternating espresso-soaked sponge and cream layers. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, dish occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `cheesecake.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a single wedge of creamy New York cheesecake with biscuit crumb base and a generous glossy red berry topping with whole raspberries and blueberries. Scene: one warm ivory ceramic plate on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire plate centered, subject occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.

### `lemonade.webp`

Use case: product-mockup. Asset type: restaurant menu photograph, square image. Primary request: photorealistic appetizing a single clear tumbler of chilled pale yellow citrus lemonade with ice cubes, fresh mint leaves and thin lemon slices, tiny condensation drops on the glass. Scene: the clear tumbler sitting directly on a pale cream stone tabletop. Style: premium yet approachable restaurant editorial food photography. Composition: slight overhead three-quarter camera angle, entire glass centered, subject occupies about 75% of frame, clean quiet margins, no hands. Lighting: soft natural window light, warm inviting tone, realistic textures and gentle shadows. No words, no logos, no watermark, no packaging, no extra dishes.
