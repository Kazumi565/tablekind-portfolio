# Menu image provenance

## Current menu photographs — 28 October 2026

The restaurant reference photographs have been replaced with reusable photographs from Wikimedia Commons. All menu WebP URLs, including compatibility category images, now serve licensed photographic replacements. Existing product identities, recipes, prices, menu coverage and stored dinner records are unchanged.

These are **representative photographs**, not photographs of an operating restaurant's exact dishes, portions or branded drinks. Related variants can share a photograph. The menu clearly labels that distinction.

- [Per-file provenance](MENU-PHOTOS.json) records the original source page, photographer, individual licence and licence URL, modifications, dimensions, byte count and SHA-256 digest for every shipped menu image.
- Visitors can open **Photo credits and licences** from the menu, linking to `/menu/photo-credits.html`. Each source image is credited there with the local filenames that use it.
- Preparation: square crop, resize to 800 × 800 and WebP compression. Each adapted image retains its original licence; CC BY-SA adaptations are offered under the same ShareAlike licence. The code's MIT licence does not cover third-party photographs.
- Photos are served locally; no visitor requests go to Commons or the original restaurant. No new image generation or paid stock purchases were used.
- Source and licence metadata were checked against Commons records. Commons guidance: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses/en
- Source-page credits and licence information must stay with redistributed menu assets. Replacements do not remove previously published photographs from Git history; no remote history has been rewritten.

## Historical illustration preparation (superseded)

The following records describe the earlier generated assets. Those files have since been replaced at the same URLs with the licensed photographs documented above. They are retained here as development history, not as provenance for the current image contents.

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
