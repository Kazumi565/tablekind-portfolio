# Menu coverage

Observed from [Andy’s Pizza Moldova](https://andys.md/) on **12 October 2026**. This dated catalog snapshot is integrated into `backend/src/main/resources/demo/menu.json`; the live restaurant menu may change. Application and visual checks are recorded in the validation documentation.

The source contains a nested 389-row aggregate followed by 21 actual categories. The aggregate is discarded to avoid counting the same menu twice. Each of the 17 relevant dining categories independently meets `ceil(0.70 × category rows)`. Portion sizes and variants count separately, and repeated items in different source categories remain separate category selections. Eight distinct original TableKind dishes remain and contribute nothing to these coverage counts. Four overlapping demo dishes (Margherita, Pepperoni, berry cheesecake and tiramisu) were removed in favor of the portion-labelled source selections.

| Source category | TableKind category | Observed rows | Required minimum | Selected | Coverage |
| --- | --- | ---: | ---: | ---: | ---: |
| Breakfasts | Breakfast | 7 | 5 | 5 | 71.43% |
| Appetizers | Starters | 12 | 9 | 9 | 75.00% |
| Salads | Salads | 8 | 6 | 6 | 75.00% |
| Soups | Soups | 6 | 5 | 5 | 83.33% |
| Pizza | Pizza | 13 | 10 | 10 | 76.92% |
| Pasta | Pasta | 5 | 4 | 4 | 80.00% |
| Main Dishes | Mains | 33 | 24 | 24 | 72.73% |
| Kids Menu | Kids | 11 | 8 | 8 | 72.73% |
| Lunch-Box | Lunch | 7 | 5 | 5 | 71.43% |
| Banquet menu | Sharing platters | 18 | 13 | 13 | 72.22% |
| Dessert | Desserts | 12 | 9 | 9 | 75.00% |
| Ice Cream | Ice cream | 25 | 18 | 18 | 72.00% |
| Cocktails | Cocktails | 22 | 16 | 16 | 72.73% |
| Beverages | Cold drinks | 40 | 28 | 28 | 70.00% |
| Hot Beverages | Hot drinks | 15 | 11 | 11 | 73.33% |
| Alcohol | Bar | 47 | 33 | 33 | 70.21% |
| Supplements | Extras | 16 | 12 | 12 | 75.00% |

**Total: 216 selected category rows from 297 observed rows across 17 relevant categories**, plus eight distinct TableKind dishes: **224 stored category entries, presented as 203 unique selectable dishes**. Identical dishes retain all category memberships but appear once in All dishes; different portions, recipes, prices or modifier choices remain separate.

## Scope and adaptation

- Delivery promotions (3 rows): promotional delivery bundles, outside the table-dining menu.
- Cutlery (6 rows): supplies rather than food or drink.
- Gift card (2 rows): financial vouchers rather than menu dishes.
- Shop (81 rows): frozen retail and grocery products rather than prepared table dining.
- Lunch, banquet dishes, cocktails, alcohol and supplements remain in scope. The source itself repeats some non-alcoholic drinks under Alcohol; those source placements are retained for coverage, and the descriptions distinguish them.

Displayed descriptions are newly written factual summaries. Restaurant-branded names are adapted to neutral TableKind names; branded drinks retain factual product names. Listed portions distinguish separately selectable variants. Names, portions and category placement are the reference facts being compared.

Prices are **fictional EUR demo prices**, calculated in minor units as `max(100, floor((source MDL × 5) / 50 + 0.5) × 50)`. This rounds to €0.50 with a €1.00 minimum. It is not an exchange-rate conversion or a representation of Andy’s current prices. The original €38.01 three-diner bill remains separately preserved.

Allergen hints conservatively use the observed ingredient lists and common recipe components. They have not been verified for complete ingredients or cross-contact; an empty list means no hint was identified, not allergen-free. These added selections have empty dietary-label lists.

Photos are original illustrative **category** images and can repeat across related dishes. They do not represent the exact recipe or listed portion. No Andy’s photography, logos or menu prose are included in the rendering data. See [image provenance](MENU-ASSETS.md).

[Machine-readable coverage](MENU-COVERAGE.json) records every selected source name and portion. The authoritative application fixture is `backend/src/main/resources/demo/menu.json`; it contains newly written descriptions, fictional prices and local image slugs. The frontend preview is generated from the same fixture. Stored source-category entries retain their provenance. The gallery removes category suffixes from displayed names and consolidates identical entries without changing existing order or payment records.

## Selected source rows

### Breakfasts → Breakfast

- Andy’s Breakfast — portion not stated
- Classic omelet — portion not stated
- Cottage cheese pancakes — portion not stated
- Pancakes with Chicken & Mushroom Sauce — 380 g
- Crepes with salted salmon — 230/25 g

### Appetizers → Starters

- Roasted Pepper Bruschetta — 200 g
- Salmon Bruschetta — 180 g
- Bruschettas with shrimp — 240 g
- Garlic toast — 120 g
- Cheese Platter — 50/40/40/40/40/20/20g
- Nachos — 400/50/50/50g
- Guacamole — 100/30 g
- Eggplant Appetizer — 100 / 20 g
- Romanian Appetizer — 100 / 20 g

### Salads → Salads

- Warm Beef Salad — 320 g
- Caesar Salad with Chicken — 300 g
- Caesar Salad with Shrimp — 290 g
- Caesar Salad with baked salmon — 290 g
- Caesar Salad with lightly salted salmon — 280 g
- Tuna Salad — 350 g

### Soups → Soups

- Red Borscht — 370/50/30/30/15 g
- Zama (Traditional Chicken Soup) — 350 / 30 / 50 / 10 g
- Chicken Cream Soup — 300/130 g
- Spinach Cream Soup — 340 / 25 g
- Mexican Soup — 350 / 40 / 10 g

### Pizza → Pizza

- Pizza Mortadella&Pistachio — 480 g
- Pizza Funghi — 580 g
- Pizza Salsicia — 470 g
- BARBEQUE Pizza — 560 g
- Bianca Pizza — 550 g
- Margherita Pizza — 380 g
- Neapolitana Pizza — 510 g
- Pepperoni Pizza — 475 g
- Pizza 5 Cheeses — 420 g
- Pizza Capricioasa — 600 g

### Pasta → Pasta

- Pasta Carbonara — 270 g
- Pasta Pollo — 350 g
- Shrimp Pasta — 320 g
- Chicken Lasagna — 450 g

### Main Dishes → Mains

- Fritto misto — 290/50/40 g
- Salmon steak with mashed potatoes — 140/200/60/50/40/30 g
- Chicken breast with potato gratin — 160/140/80/50 g
- Pork in chili sauce with rice — 250/160 g
- CHICKEN SKEWER — 200/80/80/50/50 g
- French-style meat — portion not stated
- Chicken Gyros — 140/100/100/80/50 g
- Chicken Meatballs with Mashed Potatoes — 250/220g
- Beef Stroganoff — portion not stated
- Chicken Fricassee — 360/70/50 g
- Shrimp in Cream Sauce — 200/50
- Crepes with ham and cheese — 320 g
- Pancakes with Chicken & Mushroom Sauce — 380 g
- Crepes with salted salmon — 230/25 g
- Pancakes with sweet cheese and sauce — 220 g
- Chicken Wrap — 400/80/50 g
- Beef Wrap — 350/80/50 g
- Wrap Veggie falafel — 380/80/100 g
- Crispy chicken schnitzel — 250/80/65/50/40 g
- Beef Burger — 300 / 100 / 50 g
- Chicken Burger — 260 / 100 / 50 g
- Cheeseburger — 330/100/50 g
- Breaded Chicken Breast — 160 / 130 / 50 g
- Glazed Chicken Wings — 220 / 130 / 50 g

### Kids Menu → Kids

- Soup with Meatballs — 250 g
- Cheesy pasta nuggets — 230 g
- Mashed Potatoes with Meatballs — 150 / 80 / 25 g
- Chicken shashlik — 120/70/40 g
- Smiley Potatoes — 90 / 50 g
- Mini nuggets with potato emoticons — 100/90/50 g
- Mini Burger — 120 / 65 / 50 g
- Mini pizza — 300 g

### Lunch-Box → Lunch

- Baked Chicken Steak with Buckwheat and Mushrooms — portion not stated
- Chicken Meatballs in Curry Sauce with Rice — portion not stated
- Chicken Schnitzel with Mashed Potatoes — portion not stated
- Ravioli with Ricotta and Shrimp — portion not stated
- Sea Bream Fillet with Bulgur and Quinoa — portion not stated

### Banquet menu → Sharing platters

- Crispy schnitzel for sharing — 440/100/60/60/50/50 g
- French-style meat for sharing — 1000/340/100/80/80 g
- Mixed skewers for sharing — 420/100/90/80/80/80/50/50 g
- Cold Cuts Appetizer — 120/80/80/60/50/50/50/20/15/15/10g
- Meat Platter — 320/170/140/100/70/70/60/60/50/50/50 g
- Plato with pork fat — 170 g
- Cheese Platter — 140/120/100/70/50/50/40/40 g
- Fresh Vegetable Platter — 400 / 90 / 40 / 50 g
- Bruschetta selection — 240/200/180 g
- Caesar Salad with Chicken (Banquet) — 560 g
- Veggie salad for sharing — 480 g
- Caesar Salad with Shrimp (Banquet) — portion not stated
- XXL chicken fillet — 480/50/50 g

### Dessert → Desserts

- Tort Profiterol — 190 g
- Chocolate Napoleon — 180 g
- Berry Cheesecake — 175 g
- Tiramisu — 200 g
- Chocolate Fondant — 170 g
- Fondant Dubai — 160 g
- Berry soufflé — 160 g
- Snikers Pop Ice Cream — 230 g
- Berry Boom Ice Cream — 340 g

### Ice Cream → Ice cream

- Assorted Ice Cream – 3 Scoops — 175 g
- Banana-Pineapple Ice Cream — 700 g
- Chocolate Ice Cream — 700 g
- Ice Cream Assortment — 700 g
- Ice Cream Assortment — 350 g
- Mango & Passion Fruit Ice Cream — 700 g
- Strawberry Ice Cream — 700 g
- Whipped Cream Ice Cream — 700 g
- Caramelium Ice Cream — 300 g
- Chocolate Plombir Ice Cream — 300 g
- Classic Plombir Ice Cream — 300 g
- Forest Berry Ice Cream — 300 g
- Hazelnut Ice Cream — 300 g
- Huba Buba Ice Cream — 300 g
- Înghetata Snickerrss — 300 g
- Passion Fashion Ice Cream — 700 g
- Passion Fashion Ice Cream — 300 g
- Pistachio Ice Cream — 300 g

### Cocktails → Cocktails

- Aperol Spritz Cocktail — 330 ml
- Mojito Cocktail — 330 ml
- Mojito Cocktail N/A — 330 ml
- Pina Coco — 330 ml
- Pina Coco N/A — 330 ml
- Pink berry tonic — 400 ml
- Sex on the Beach — 400 ml
- Cosmopolitan — 180 ml
- Rosé Sangria Cocktail — 350 ml
- Rosé Sangria Cocktail – 1L — 1000 ml
- Tropical Cocktail — 330 ml
- Blackcurrant Lemonade — 330 ml
- Lemonade — 330 ml
- Passion Fruit Lemonade — 330 ml
- Chocolate Freakshake — 300 ml
- Banana-Mango Milkshake — 300 ml

### Beverages → Cold drinks

- Chocolate Freakshake — 300 ml
- Salted Caramel Milkshake — portion not stated
- Banana-Mango Milkshake — 300 ml
- Chocolate Milkshake — 300 ml
- Strawberry Milkshake — 300 ml
- Vanilla Milkshake — 300 ml
- Almond Ice Latte — 350 ml
- Espresso Tonic — 330 ml
- Ice Latte — 350 ml
- Mojito Cocktail N/A — 330 ml
- Blackcurrant Lemonade — 330 ml
- Cherry Cola Cocktail — 330 ml
- Lemonade — 330 ml
- Lemonade 1 L — 1000 ml
- Orangeade — 330 ml
- Orangeade 1 L — 1000 ml
- Passion Fruit Lemonade — 330 ml
- Pina Coco N/A — 330 ml
- Raspberry Fizz Lemonade — 330 ml
- Tropical Cocktail — 330 ml
- Fresh Grapefruit Juice 200 ml — 200 ml
- Fresh Orange Juice 200 ml — 200 ml
- Apple Juice — 950 ml
- Mango Juice — 950 ml
- Coca-Cola 0,5 — 500 ml
- Sprite 0,5 — 500 ml
- Dorna carbo 0,5 — 500 ml
- Dorna plată 0,5 — 500 ml

### Hot Beverages → Hot drinks

- Glühwein — 220 ml
- Blackcurrant Tea — 400 ml
- Sea Buckthorn Tea — 400 ml
- Signature Mint Tea — 400 ml
- Almond Hot Cocoa — 250 ml
- Almond Latte — 250 ml
- Coffee Latte — 250 ml
- Espresso — 30 ml
- Hot Cocoa — 250 ml
- Americano — 100 ml
- Cappuccino — 150 ml

### Alcohol → Bar

- Glühwein — 220 ml
- Aperol Spritz Cocktail — 330 ml
- Mojito Cocktail — 330 ml
- Mojito Cocktail N/A — 330 ml
- Pina Coco — 330 ml
- Pink berry tonic — 400 ml
- Sex on the Beach — 400 ml
- Cosmopolitan — 180 ml
- Rosé Sangria Cocktail — 350 ml
- Rosé Sangria Cocktail – 1L — 1000 ml
- Red Wine — 1000 ml
- Rosé Wine — 1000 ml
- White Wine — 1000 ml
- Chişinău Draft Beer — 1000 ml
- Chișinău Light Beer — 500 ml
- Chișinău Light Beer — 2250 ml
- Corona Extra — 355 ml
- Efes Non-Alcoholic — 500 ml
- Efes Pilsner Beer — 500 ml
- Finch Beer — 500 ml
- Franziskaner Weissbier — 500 ml
- Kozel Černý Beer — 500 ml
- Kozel Svetly — 500 ml
- Timișoreana — 500 ml
- Bostavan Chardonnay White Dry Wine — 750 ml
- Bostavan Merlot Red Dry Wine — 750 ml
- Bostavan Muscat Rosé — 750 ml
- PURCARI Nocturne Cabernet Sauvignon Red Sec — 750 ml
- Purcari Nocturne Pinot Grigio Dry Wine — 750 ml
- Purcari Nocturne Rose sec — 750 ml
- Purcari Nocturne Sauvignon Blanc Dry Wine — 750 ml
- Cricova Crisecco Brut — 750 ml
- Cricova Lacrima Dulce — 750 ml

### Supplements → Extras

- Garlic toast — 120 g
- Flatbread with Butter and Garlic Sheep Cheese — 60 g (1 pc)
- Flatbread with Butter and Sheep Cheese — 60 g (1 pc)
- Bread Rusks — 50 g
- Hot Bread — 150 g
- Ciabatta — 100 g
- Focaccia — 220 g
- Mayonnaise — 50 g
- Tartar Sauce — 50g
- Sour Cream — 50 g
- Ketchup — 50 g
- Zesty sauce — 50 g
