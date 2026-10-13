import type { Product } from "./types";

const categories = new Set([
  "Pizza",
  "Breakfast",
  "Starters",
  "Salads",
  "Soups",
  "Pasta",
  "Mains",
  "Kids",
  "Lunch",
  "Sharing platters",
  "Desserts",
  "Ice cream",
  "Cocktails",
  "Cold drinks",
  "Hot drinks",
  "Bar",
  "Extras",
]);
const photoAliases: Record<string, string> = {
  '["House breakfast",750,"A full breakfast plate with eggs, bacon, sausages and beans, plus toast and hash browns.","/menu/breakfast.webp"]':
    "/menu/dish-andy-s-breakfast-2-129d46dc.webp",
  '["Classic omelet",450,"A cheese omelet with fresh vegetables, salad leaves and a little honey dressing.","/menu/breakfast.webp"]':
    "/menu/dish-shakshuka-1-8186584e.webp",
  '["Cottage cheese pancakes",500,"Soft cheese pancakes with berry sauce, sour cream and flaked almonds.","/menu/crepes.webp"]':
    "/menu/dish-cottage-cheese-pancakes-3-f240cc84.webp",
  '["Pancakes with Chicken & Mushroom Sauce · 380 g",650,"Savoury pancakes filled with chicken, finished with creamy mushrooms and Edam.","/menu/crepes.webp"]':
    "/menu/dish-pancakes-with-chicken-mushroom-sauce-2-7fdc47ef.webp",
  '["Crepes with salted salmon · 230/25 g",700,"Light crepes with salmon, cucumber cheese filling and lemon.","/menu/crepes.webp"]':
    "/menu/dish-crepes-with-salted-salmon-1-b724d710.webp",
  '["Roasted Pepper Bruschetta · 200 g",450,"Toasted ciabatta with roasted peppers, Parmesan cream and walnuts.","/menu/bruschetta.webp"]':
    "/menu/dish-roasted-pepper-bruschetta-2-7d475d5a.webp",
  '["Salmon Bruschetta · 180 g",500,"Salmon and cucumber over Parmesan cream on ciabatta toast.","/menu/bruschetta.webp"]':
    "/menu/dish-salmon-bruschetta-3-4d6018e3.webp",
  '["Bruschettas with shrimp · 240 g",500,"Shrimp and guacamole toast with tomato, cream cheese and rocket.","/menu/bruschetta.webp"]':
    "/menu/dish-bruschettas-with-shrimp-3-311f09de.webp",
  '["Garlic toast · 120 g",200,"Crisp ciabatta with garlic butter, Parmesan and parsley.","/menu/bread.webp"]':
    "/menu/dish-ciabatta-1-eec2c5c4.webp",
  '["Cheese Platter · 50/40/40/40/40/20/20g",750,"A selection of cheeses with olives, walnuts and crisp crackers.","/menu/starter.webp"]':
    "/menu/dish-cheese-platter-1-fb000524.webp",
  '["Nachos · 400/50/50/50g",700,"Crunchy nachos with beef, beans, melted cheese and a selection of lively sauces.","/menu/starter.webp"]':
    "/menu/dish-nachos-1-f0c6603e.webp",
  '["Guacamole · 100/30 g",350,"Avocado dip with tomato and onion, served alongside crunchy nachos.","/menu/starter.webp"]':
    "/menu/dish-guacamole-2-5ef30854.webp",
  '["Eggplant Appetizer · 100 / 20 g",300,"An aubergine spread with tahini, mayonnaise and red onion, served with ciabatta.","/menu/starter.webp"]':
    "/menu/dish-eggplant-appetizer-2-a1c531fa.webp",
  '["Romanian Appetizer · 100 / 20 g",300,"A rustic aubergine and pepper spread with tomato, garlic and parsley.","/menu/starter.webp"]':
    "/menu/dish-romanian-appetizer-2-7a839201.webp",
  '["Warm Beef Salad · 320 g",800,"Warm beef and mushrooms over crisp leaves with broccoli, peppers and a sesame dressing.","/menu/salad.webp"]':
    "/menu/dish-warm-beef-salad-1-5dcb2798.webp",
  '["Caesar Salad with Chicken · 300 g",600,"Chicken and crunchy leaves with Parmesan, egg, croutons and Caesar dressing.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-chicken-1-52da8eb5.webp",
  '["Caesar Salad with Shrimp · 290 g",700,"Shrimp Caesar with crisp lettuce, croutons, Parmesan and egg.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-shrimp-1-f21be3df.webp",
  '["Caesar Salad with baked salmon · 290 g",750,"Baked salmon on Caesar leaves with quail eggs and Parmesan croutons.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-lightly-salted-salmon-1-ff354fd1.webp",
  '["Caesar Salad with lightly salted salmon · 280 g",750,"Lightly salted salmon with Caesar leaves, quail eggs and crunchy croutons.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-lightly-salted-salmon-1-d2802600.webp",
  '["Tuna Salad · 350 g",750,"Tuna, potatoes, broccoli and egg with olives and a lemon dressing.","/menu/salad.webp"]':
    "/menu/dish-tuna-salad-1-9e836c13.webp",
  '["Red Borscht · 370/50/30/30/15 g",400,"Beetroot and vegetable broth with pork ribs, sour cream and bread.","/menu/soup.webp"]':
    "/menu/dish-red-borscht-1-4dcc4390.webp",
  '["Zama (Traditional Chicken Soup) · 350 / 30 / 50 / 10 g",400,"A traditional chicken and noodle broth with herbs, a little sourness and bread.","/menu/soup.webp"]':
    "/menu/dish-zama-traditional-chicken-soup-1-dbc754de.webp",
  '["Chicken Cream Soup · 300/130 g",400,"Creamy chicken and mushroom soup, served with a bread roll.","/menu/soup.webp"]':
    "/menu/dish-chicken-cream-soup-1-1ed901ae.webp",
  '["Spinach Cream Soup · 340 / 25 g",400,"Smooth spinach soup with cream, Parmesan and crunchy croutons.","/menu/soup.webp"]':
    "/menu/dish-spinach-cream-soup-1-682aff9b.webp",
  '["Mexican Soup · 350 / 40 / 10 g",450,"A warming beef, bean and corn soup with chilli and nachos.","/menu/soup.webp"]':
    "/menu/dish-mexican-soup-1-23d164fe.webp",
  '["Mortadella and pistachio pizza · 480 g",750,"A creamy pizza with mortadella, pistachios, Parmesan and a touch of truffle.","/menu/garden-pizza.webp"]':
    "/menu/dish-pizza-mortadella-pistachio-1-e22fe358.webp",
  '["Chicken and mushroom pizza · 580 g",750,"Chicken and mushrooms on a creamy pizza base with Parmesan and truffle salsa.","/menu/garden-pizza.webp"]':
    "/menu/dish-pizza-funghi-2-6dae62a4.webp",
  '["Sausage and mushroom pizza · 470 g",750,"Pork and chicken sausage pizza with mushrooms, pancetta and creamy truffle sauce.","/menu/pepperoni.webp"]':
    "/menu/dish-pizza-salsicia-1-9fd4da8a.webp",
  '["Barbecue pizza · 560 g",750,"A smoky pizza with chicken, bacon, salami and sweet peppers.","/menu/pepperoni.webp"]':
    "/menu/dish-barbeque-pizza-2-3b87734c.webp",
  '["Bianca Pizza · 550 g",750,"White pizza with ham, mushrooms, mozzarella and Parmesan.","/menu/garden-pizza.webp"]':
    "/menu/dish-bianca-pizza-2-20e6210b.webp",
  '["Margherita Pizza · 380 g",500,"A classic tomato pizza with mozzarella, basil and olive oil.","/menu/margherita.webp"]':
    "/menu/dish-margherita-pizza-2-df5b9e18.webp",
  '["Neapolitana Pizza · 510 g",700,"Tomato pizza topped with ham, mushrooms, olives and cheese.","/menu/pepperoni.webp"]':
    "/menu/dish-neapolitana-pizza-2-c103a516.webp",
  '["Pepperoni Pizza · 475 g",700,"A tomato and cheese pizza with slices of seasoned salami.","/menu/pepperoni.webp"]':
    "/menu/dish-pepperoni-pizza-2-fd502a85.webp",
  '["Five cheese pizza · 420 g",700,"A rich cheese pizza with mozzarella, Brie, blue cheese and Parmesan.","/menu/garden-pizza.webp"]':
    "/menu/dish-pizza-5-cheeses-2-b5efc7ca.webp",
  '["Pizza Capricioasa · 600 g",700,"Ham, aubergine and mushroom pizza with feta and a creamy garlic finish.","/menu/pepperoni.webp"]':
    "/menu/dish-pizza-capricioasa-4-aac71911.webp",
  '["Pasta Carbonara · 270 g",650,"Spaghetti with bacon, Parmesan and an egg sauce.","/menu/pasta.webp"]':
    "/menu/dish-pasta-carbonara-1-6d562dae.webp",
  '["Pasta Pollo · 350 g",650,"Chicken and mushroom tagliatelle with cream, Parmesan and truffle.","/menu/pasta.webp"]':
    "/menu/dish-pasta-pollo-2-0f1ca86c.webp",
  '["Shrimp Pasta · 320 g",700,"Spaghetti with shrimp, vegetables and a creamy Parmesan sauce.","/menu/pasta.webp"]':
    "/menu/dish-shrimp-pasta-1-918dfd72.webp",
  '["Chicken Lasagna · 450 g",750,"Layers of pasta, chicken and mushrooms with bechamel and melted cheese.","/menu/pasta.webp"]':
    "/menu/dish-chicken-lasagna-2-d6fbe646.webp",
  '["Fritto misto · 290/50/40 g",900,"A crisp seafood selection with shrimp, calamari, mussels and vegetables.","/menu/grilled-fish.webp"]':
    "/menu/dish-fritto-misto-1-5f9c7871.webp",
  '["Salmon steak with mashed potatoes · 140/200/60/50/40/30 g",1350,"Salmon steak with buttery mash, broccoli and lemon sauce.","/menu/grilled-fish.webp"]':
    "/menu/dish-salmon-steak-with-mashed-potatoes-1-c6d580e4.webp",
  '["Chicken breast with potato gratin · 160/140/80/50 g",800,"Chicken steak, creamy potato gratin and fresh salad with tartar sauce.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-breast-with-potato-gratin-4-ff4a9741.webp",
  '["Pork in chili sauce with rice · 250/160 g",750,"Sweet chilli pork with colourful vegetables, egg and rice.","/menu/meat-platter.webp"]':
    "/menu/dish-pork-in-chili-sauce-with-rice-2-7400643d.webp",
  '["Chicken skewers · 200/80/80/50/50 g",750,"Chicken thigh skewers with peppers, flatbread, pickled onion and dipping sauces.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-skewer-3-77ea5162.webp",
  '["French-style meat",850,"A pork chop topped with mushrooms, bacon and cheese, served with fresh salad.","/menu/meat-platter.webp"]':
    "/menu/dish-french-style-meat-1-fe847efb.webp",
  '["Chicken Gyros · 140/100/100/80/50 g",750,"Seasoned chicken with pita, fries, salad and sheep cheese.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-gyros-1-db972f81.webp",
  '["Chicken Meatballs with Mashed Potatoes · 250/220g",600,"Chicken meatballs in a tomato cream sauce beside buttery mashed potatoes.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-meatballs-in-tomato-sauce-with-mashed-potatoes-2-82ef9d9c.webp",
  '["Beef Stroganoff",900,"Tender beef and mushrooms in a creamy sauce, served with mash and pickles.","/menu/meat-platter.webp"]':
    "/menu/dish-beef-stroganoff-1-c701299b.webp",
  '["Chicken Fricassee · 360/70/50 g",750,"Chicken thigh in mushroom cream, with pickled cucumber on the side.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-fricassee-2-cdae7d8c.webp",
  '["Shrimp in Cream Sauce · 200/50",900,"Garlic shrimp in wine cream with warm ciabatta and lemon.","/menu/grilled-fish.webp"]':
    "/menu/dish-shrimp-in-cream-sauce-1-7c2c9516.webp",
  '["Crepes with ham and cheese · 320 g",650,"Warm crepes with ham, cheese sauce and a spoonful of pesto.","/menu/crepes.webp"]':
    "/menu/dish-crepes-with-salmon-and-spinach-3-d7d7d0aa.webp",
  '["Pancakes with sweet cheese and sauce · 220 g",500,"Sweet cheese crepes with raisins, berries and whipped cream.","/menu/crepes.webp"]':
    "/menu/dish-pancakes-with-sweet-cheese-and-sauce-1-8be9c10b.webp",
  '["Chicken Wrap · 400/80/50 g",650,"A chicken and cheddar wrap with fresh salad, fries and Greek-style sauce.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-wrap-4-ac294e86.webp",
  '["Beef Wrap · 350/80/50 g",700,"A beef and cheddar wrap with beans, corn, peppers and fries.","/menu/meat-platter.webp"]':
    "/menu/dish-beef-wrap-3-d5dcb655.webp",
  '["Falafel wrap · 380/80/100 g",600,"Falafel and salad in a tortilla, with guacamole, creamy sauce and fries.","/menu/meat-platter.webp"]':
    "/menu/dish-wrap-veggie-falafel-4-2cd051e4.webp",
  '["Crispy chicken schnitzel · 250/80/65/50/40 g",700,"Breaded chicken schnitzel with fries, fresh salad and a squeeze of lemon.","/menu/crispy-chicken.webp"]':
    "/menu/dish-crispy-chicken-schnitzel-3-17a79b34.webp",
  '["Beef Burger · 300 / 100 / 50 g",700,"A beef burger with cheese, pickles and onion, served with a potato side.","/menu/burger.webp"]':
    "/menu/dish-beef-burger-2-a6eecd8c.webp",
  '["Chicken Burger · 260 / 100 / 50 g",650,"A crisp chicken burger with tomato, pickles and a potato side.","/menu/burger.webp"]':
    "/menu/dish-chicken-burger-2-80d0883e.webp",
  '["Cheeseburger · 330/100/50 g",800,"A beef burger with bacon, cheese sauce and caramelised onion, plus fries.","/menu/burger.webp"]':
    "/menu/dish-maxi-burger-1-fc613e81.webp",
  '["Breaded Chicken Breast · 160 / 130 / 50 g",600,"Crisp chicken breast with fries and a choice of ketchup or spicy sauce.","/menu/crispy-chicken.webp"]':
    "/menu/dish-breaded-chicken-breast-1-cbfd0c0c.webp",
  '["Glazed Chicken Wings · 220 / 130 / 50 g",600,"Glazed chicken wings served with golden fries.","/menu/roast-chicken.webp"]':
    "/menu/dish-glazed-chicken-wings-1-92dc7377.webp",
  '["Soup with Meatballs · 250 g",250,"A smaller bowl of vegetable broth with chicken meatballs and herbs.","/menu/soup.webp"]':
    "/menu/dish-soup-with-meatballs-1-51cf838e.webp",
  '["Cheesy pasta with nuggets · 230 g",350,"Creamy cheese pasta with little chicken nuggets and parsley.","/menu/pasta.webp"]':
    "/menu/dish-cheesy-pasta-nuggets-1-4ef42af9.webp",
  '["Mashed Potatoes with Meatballs · 150 / 80 / 25 g",350,"A child-sized helping of chicken meatballs and mash with cucumber.","/menu/meat-platter.webp"]':
    "/menu/dish-mashed-potatoes-with-meatballs-1-b7b70954.webp",
  '["Chicken skewers · 120/70/40 g",350,"Chicken skewers with mashed potatoes, pepper and cucumber.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-shashlik-1-a131d370.webp",
  '["Smiley Potatoes · 90 / 50 g",200,"Crisp smile-shaped potatoes with a pot of ketchup.","/menu/meat-platter.webp"]':
    "/menu/dish-smiley-potatoes-1-b3058fbd.webp",
  '["Mini nuggets with potato smiles · 100/90/50 g",350,"Little chicken nuggets with smile-shaped potatoes and ketchup.","/menu/crispy-chicken.webp"]':
    "/menu/dish-mini-nuggets-with-potato-emoticons-1-f99dea4b.webp",
  '["Mini Burger · 120 / 65 / 50 g",350,"A small chicken cheeseburger with cucumber and smile-shaped potatoes.","/menu/burger.webp"]':
    "/menu/dish-mini-burger-1-733d2e16.webp",
  '["Mini pizza · 300 g",350,"A little pizza with ham, cheese, tomato, peppers and corn.","/menu/margherita.webp"]':
    "/menu/dish-mini-pizza-1-aa640bf9.webp",
  '["Baked Chicken Steak with Buckwheat and Mushrooms",750,"Baked chicken with mozzarella and pesto, served with mushroom buckwheat.","/menu/roast-chicken.webp"]':
    "/menu/dish-baked-chicken-steak-with-buckwheat-and-mushrooms-1-0589dc10.webp",
  '["Chicken Meatballs in Curry Sauce with Rice",750,"Chicken meatballs in a gentle curry sauce, served over rice.","/menu/roast-chicken.webp"]':
    "/menu/dish-chicken-meatballs-in-curry-sauce-with-rice-3-9a5ec4f5.webp",
  '["Chicken Schnitzel with Mashed Potatoes",750,"Crisp chicken with creamy mash, salad leaves and cherry tomatoes.","/menu/crispy-chicken.webp"]':
    "/menu/dish-chicken-schnitzel-with-mashed-potatoes-1-cd3dc8e6.webp",
  '["Ravioli with Ricotta and Shrimp",950,"Ricotta ravioli with shrimp, pesto and a Parmesan cream sauce.","/menu/pasta.webp"]':
    "/menu/dish-ravioli-with-ricotta-and-shrimp-1-fe4ac8b2.webp",
  '["Sea Bream Fillet with Bulgur and Quinoa",1050,"Sea bream fillet with mixed grains and a fresh vegetable salsa.","/menu/grilled-fish.webp"]':
    "/menu/dish-sea-bream-fillet-with-bulgur-and-quinoa-1-35ad523d.webp",
  '["Crispy schnitzel for sharing · 440/100/60/60/50/50 g",1200,"A generous chicken schnitzel platter with sheep cheese, vegetables and tartar sauce.","/menu/crispy-chicken.webp"]':
    "/menu/dish-crispy-schnitzel-for-sharing-1-24b8e0a8.webp",
  '["French-style meat for sharing · 1000/340/100/80/80 g",2450,"A sharing platter of pork, mushrooms and cheese with garlic potatoes and pickles.","/menu/meat-platter.webp"]':
    "/menu/dish-french-style-meat-for-sharing-1-1cacee54.webp",
  '["Mixed skewers for sharing · 420/100/90/80/80/80/50/50 g",1450,"Chicken skewers for the table, with flatbread, olives, vegetables and sauces.","/menu/meat-platter.webp"]':
    "/menu/dish-mixed-skewers-for-sharing-1-663c4b90.webp",
  '["Cold Cuts Appetizer · 120/80/80/60/50/50/50/20/15/15/10g",1350,"Roast pork, ham and bacon with dark bread, olives and mustard.","/menu/meat-platter.webp"]':
    "/menu/dish-cold-cuts-appetizer-2-02d94c70.webp",
  '["Meat Platter · 320/170/140/100/70/70/60/60/50/50/50 g",2550,"A hearty selection of pork, steak and sausages with bread and sharp condiments.","/menu/meat-platter.webp"]':
    "/menu/dish-meat-platter-2-f8bef848.webp",
  '["Traditional lard plate · 170 g",500,"A traditional lard plate with garlic bread, pickles and spring onion.","/menu/meat-platter.webp"]':
    "/menu/dish-plato-with-pork-fat-2-80a61005.webp",
  '["Cheese Platter · 140/120/100/70/50/50/40/40 g",1550,"A selection of cheeses with olives, walnuts and crisp crackers.","/menu/meat-platter.webp"]':
    "/menu/dish-cheese-platter-2-7563212e.webp",
  '["Fresh Vegetable Platter · 400 / 90 / 40 / 50 g",650,"Fresh vegetables, olives and flatbread with tartar sauce for dipping.","/menu/salad.webp"]':
    "/menu/dish-fresh-vegetable-platter-1-e738fece.webp",
  '["Bruschetta selection · 240/200/180 g",1300,"A sharing selection of shrimp, salmon and pepper toasts with creamy cheese.","/menu/bruschetta.webp"]':
    "/menu/dish-bruschetta-selection-1-8f1a2585.webp",
  '["Chicken Caesar for sharing · 560 g",1200,"A table-sized chicken Caesar with Parmesan, egg and croutons.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-chicken-banquet-1-e4794f4c.webp",
  '["Veggie salad for sharing · 480 g",650,"A generous crisp salad with cabbage, apple, celery and toasted seeds.","/menu/salad.webp"]':
    "/menu/dish-veggie-salad-for-sharing-1-644a3db2.webp",
  '["Shrimp Caesar for sharing",1350,"A generous shrimp Caesar with egg, croutons and Parmesan.","/menu/salad.webp"]':
    "/menu/dish-caesar-salad-with-shrimp-banquet-1-136183a9.webp",
  '["XXL chicken fillet · 480/50/50 g",1050,"A large platter of breaded chicken fillet with ketchup and spicy dip.","/menu/crispy-chicken.webp"]':
    "/menu/dish-xxl-chicken-fillet-2-4a6831a6.webp",
  '["Chocolate profiterole cake · 190 g",450,"A chocolate and cream profiterole cake with a berry finish.","/menu/cheesecake.webp"]':
    "/menu/dish-tort-profiterol-1-fb677578.webp",
  '["Chocolate Napoleon · 180 g",450,"Layers of chocolate pastry and cream with a raspberry accent.","/menu/cheesecake.webp"]':
    "/menu/dish-chocolate-napoleon-1-9bd59994.webp",
  '["Berry Cheesecake · 175 g",400,"Cream cheese cake with an almond-enriched base and berry sauce.","/menu/cheesecake.webp"]':
    "/menu/dish-berry-cheesecake-1-d04e094f.webp",
  '["Tiramisu · 200 g",500,"Coffee-soaked biscuits with mascarpone cream, cocoa and a little Amaretto.","/menu/tiramisu.webp"]':
    "/menu/dish-tiramisu-1-1519cbc6.webp",
  '["Chocolate Fondant · 170 g",400,"A warm chocolate centre with vanilla ice cream and berry sauce.","/menu/cheesecake.webp"]':
    "/menu/dish-chocolate-fondant-2-975a2a05.webp",
  '["Pistachio kataifi fondant · 160 g",550,"A warm white chocolate and pistachio cake with crisp kataifi and vanilla ice cream.","/menu/cheesecake.webp"]':
    "/menu/dish-berry-souffl-1-26eb51f6.webp",
  '["Berry soufflé · 160 g",500,"A light yogurt and berry dessert with white chocolate and almonds.","/menu/cheesecake.webp"]':
    "/menu/dish-berry-souffl-2-2f9476ec.webp",
  '["Peanut caramel sundae · 230 g",400,"Chocolate and salted caramel scoops with peanuts, wafers and popcorn.","/menu/ice-cream.webp"]':
    "/menu/dish-sunny-tropic-ice-cream-1-1654bfd1.webp",
  '["Berry Boom Ice Cream · 340 g",400,"A playful sundae of vanilla and tropical scoops with berries and chocolate sauce.","/menu/ice-cream.webp"]':
    "/menu/dish-snikers-pop-ice-cream-1-71710a1e.webp",
  '["Assorted Ice Cream – 3 Scoops · 175 g",350,"A three-scoop selection for a little of everything.","/menu/ice-cream.webp"]':
    "/menu/dish-assorted-ice-cream-3-scoops-1-1e6cd00b.webp",
  '["Banana-Pineapple Ice Cream · 700 g",850,"A creamy banana and pineapple flavoured ice cream.","/menu/ice-cream.webp"]':
    "/menu/dish-banana-pineapple-ice-cream-1-ad254c01.webp",
  '["Chocolate Ice Cream · 700 g",850,"A smooth cocoa ice cream made with milk and cream butter.","/menu/ice-cream.webp"]':
    "/menu/dish-chocolate-ice-cream-1-85bfa745.webp",
  '["Ice Cream Assortment · 700 g",850,"A larger selection of assorted ice cream scoops.","/menu/ice-cream.webp"]':
    "/menu/dish-ice-cream-assortment-1-1478a0b1.webp",
  '["Ice Cream Assortment · 350 g",500,"A larger selection of assorted ice cream scoops.","/menu/ice-cream.webp"]':
    "/menu/dish-ice-cream-assortment-1-8d8cd883.webp",
  '["Mango & Passion Fruit Ice Cream · 700 g",850,"Milk ice cream with mango and passion fruit flavours.","/menu/ice-cream.webp"]':
    "/menu/dish-mango-passion-fruit-ice-cream-1-b36d815f.webp",
  '["Strawberry Ice Cream · 700 g",850,"A creamy strawberry ice cream with a yogurt note.","/menu/ice-cream.webp"]':
    "/menu/dish-strawberry-ice-cream-1-216d243f.webp",
  '["Whipped Cream Ice Cream · 700 g",850,"A classic milk ice cream with a soft vanilla finish.","/menu/ice-cream.webp"]':
    "/menu/dish-whipped-cream-ice-cream-1-b1623a53.webp",
  '["Caramel cocoa ice cream · 300 g",350,"A rich caramel and cocoa ice cream with a pinch of sea salt.","/menu/ice-cream.webp"]':
    "/menu/dish-passion-fashion-ice-cream-1-90f42bd3.webp",
  '["Chocolate Plombir Ice Cream · 300 g",300,"A rich chocolate version of traditional milk ice cream.","/menu/ice-cream.webp"]':
    "/menu/dish-chocolate-plombir-ice-cream-1-951b28ae.webp",
  '["Classic Plombir Ice Cream · 300 g",300,"Traditional creamy milk ice cream with a vanilla finish.","/menu/ice-cream.webp"]':
    "/menu/dish-classic-plombir-ice-cream-2-456856ee.webp",
  '["Forest Berry Ice Cream · 300 g",350,"Creamy ice cream swirled with forest berry flavours.","/menu/ice-cream.webp"]':
    "/menu/dish-forest-berry-ice-cream-1-b1ed922f.webp",
  '["Hazelnut Ice Cream · 300 g",400,"A creamy hazelnut ice cream with a cocoa note.","/menu/ice-cream.webp"]':
    "/menu/dish-hazelnut-ice-cream-1-15bf7369.webp",
  '["Bubblegum ice cream · 300 g",400,"A playful bubblegum-flavoured milk ice cream.","/menu/ice-cream.webp"]':
    "/menu/dish-huba-buba-ice-cream-1-649097e0.webp",
  '["Peanut chocolate ice cream · 300 g",400,"Peanut and chocolate ice cream with chopped peanuts.","/menu/ice-cream.webp"]':
    "/menu/dish-nghetata-snickerrss-1-a1ef19c6.webp",
  '["Mango passion fruit ice cream · 700 g",650,"A creamy tropical ice cream with mango and passion fruit.","/menu/ice-cream.webp"]':
    "/menu/dish-passion-fashion-ice-cream-1-d6b35a9d.webp",
  '["Mango passion fruit ice cream · 300 g",350,"A creamy tropical ice cream with mango and passion fruit.","/menu/ice-cream.webp"]':
    "/menu/dish-sweet-cookies-ice-cream-1-62f28b0d.webp",
  '["Pistachio Ice Cream · 300 g",400,"Milk ice cream enriched with pistachio paste.","/menu/ice-cream.webp"]':
    "/menu/dish-pistachio-ice-cream-1-066cb1ee.webp",
  '["Aperol Spritz Cocktail · 330 ml",400,"Aperol and sparkling wine over ice with orange. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-aperol-spritz-cocktail-1-8e08aa29.webp",
  '["Mojito Cocktail · 330 ml",400,"White rum with lime, mint and soda over ice. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-alcoholic-mojito-cocktail-1-bce289f5.webp",
  '["Virgin mojito · 330 ml",350,"A sparkling lime and mint cooler without added alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-mojito-cocktail-1-f419c136.webp",
  '["Pineapple coconut rum cooler · 330 ml",400,"A rum, pineapple and coconut cooler with a citrus lift. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-cocktail-pina-colada-1-ae0c39a4.webp",
  '["Virgin pineapple coconut cooler · 330 ml",350,"Pineapple and coconut with condensed milk, poured over ice without added alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-pi-a-colada-cocktail-1-38aaaf15.webp",
  '["Pink berry tonic · 400 ml",400,"Gin and tonic with red currants, lemon and thyme. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-gin-tonic-1-5cfdef79.webp",
  '["Sex on the Beach · 400 ml",400,"A vodka cooler with peach, pomegranate and elderflower. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-sex-on-the-beach-1-3bb2ea85.webp",
  '["Cosmopolitan · 180 ml",400,"Vodka and orange liqueur with cranberry and citrus. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-aperol-spritz-cocktail-1-bf58934e.webp",
  '["Rosé Sangria Cocktail · 350 ml",350,"Rosé wine with cherry and orange, lengthened with sparkling water. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-ros-sangria-cocktail-2-fad29604.webp",
  '["Rose sangria jug · 1000 ml",750,"A sharing jug of rose sangria with cherry and citrus. Contains alcohol.","/menu/cocktail.webp"]':
    "/menu/dish-ros-sangria-cocktail-1l-2-66d91bfc.webp",
  '["Tropical Cocktail · 330 ml",300,"A mango cooler with chocolate, lemon and a fresh mint finish.","/menu/cocktail.webp"]':
    "/menu/dish-tropical-cocktail-1-1fe5dde2.webp",
  '["Blackcurrant Lemonade · 330 ml",300,"Blackcurrant and lime fizz with a little hibiscus and cinnamon.","/menu/cocktail.webp"]':
    "/menu/dish-blackcurrant-lemonade-1-eaec1ab4.webp",
  '["Lemonade · 330 ml",250,"A sparkling lemon cooler with fresh mint and ice.","/menu/cocktail.webp"]':
    "/menu/dish-lemonade-1-18c2feeb.webp",
  '["Passion Fruit Lemonade · 330 ml",300,"Passion fruit and orange fizz with lime and mint.","/menu/cocktail.webp"]':
    "/menu/dish-passion-fruit-lemonade-1-bec56d4e.webp",
  '["Chocolate Freakshake · 300 ml",500,"An indulgent chocolate ice cream shake with cream and chocolate pieces.","/menu/milkshake.webp"]':
    "/menu/dish-strawberry-freakshake-1-defaa64e.webp",
  '["Banana-Mango Milkshake · 300 ml",300,"Vanilla ice cream blended with banana and mango.","/menu/milkshake.webp"]':
    "/menu/dish-banana-mango-milkshake-1-c177ceed.webp",
  '["Salted Caramel Milkshake",300,"Vanilla and caramel ice cream blended with milk and caramelised nuts.","/menu/milkshake.webp"]':
    "/menu/dish-salted-caramel-1-cd7a4099.webp",
  '["Chocolate Milkshake · 300 ml",300,"A creamy chocolate shake finished with chocolate shavings.","/menu/milkshake.webp"]':
    "/menu/dish-chocolate-milkshake-1-86723f2f.webp",
  '["Strawberry Milkshake · 300 ml",300,"Strawberry ice cream and milk with a bright berry finish.","/menu/milkshake.webp"]':
    "/menu/dish-strawberry-milkshake-1-2233a50e.webp",
  '["Vanilla Milkshake · 300 ml",300,"A creamy vanilla shake with a little cherry syrup.","/menu/milkshake.webp"]':
    "/menu/dish-vanilla-milkshake-1-38f2bb75.webp",
  '["Iced almond latte · 350 ml",300,"Espresso and almond drink over ice with caramel syrup.","/menu/coffee.webp"]':
    "/menu/dish-iced-latte-1-0d751292.webp",
  '["Espresso Tonic · 330 ml",250,"Chilled espresso with tonic, lemon and ice.","/menu/coffee.webp"]':
    "/menu/dish-espresso-tonic-1-c517ac6f.webp",
  '["Iced latte · 350 ml",250,"Iced espresso and milk with a choice of chocolate or caramel syrup.","/menu/coffee.webp"]':
    "/menu/dish-iced-latte-1-03606971.webp",
  '["Virgin mojito · 330 ml",350,"A sparkling lime and mint cooler without added alcohol.","/menu/lemonade.webp"]':
    "/menu/dish-mojito-cocktail-1-f419c136.webp",
  '["Blackcurrant Lemonade · 330 ml",300,"Blackcurrant and lime fizz with a little hibiscus and cinnamon.","/menu/lemonade.webp"]':
    "/menu/dish-blackcurrant-lemonade-1-eaec1ab4.webp",
  '["Cherry Cola Cocktail · 330 ml",200,"Cola brightened with cherry syrup and mint, served over ice.","/menu/lemonade.webp"]':
    "/menu/dish-cherry-pepsi-cocktail-1-824023e0.webp",
  '["Lemonade · 330 ml",250,"A sparkling lemon cooler with fresh mint and ice.","/menu/lemonade.webp"]':
    "/menu/dish-lemonade-1-18c2feeb.webp",
  '["Lemonade jug · 1000 ml",550,"A sharing jug of sparkling lemon and mint lemonade.","/menu/lemonade.webp"]':
    "/menu/dish-lemonade-1-l-1-8bd619cb.webp",
  '["Orangeade · 330 ml",250,"Fresh orange fizz with mint, served over ice.","/menu/lemonade.webp"]':
    "/menu/dish-orangeade-1-3003be90.webp",
  '["Orangeade jug · 1000 ml",550,"A sharing jug of orange fizz with fresh mint.","/menu/lemonade.webp"]':
    "/menu/dish-orangeade-1-l-1-6398ed0f.webp",
  '["Passion Fruit Lemonade · 330 ml",300,"Passion fruit and orange fizz with lime and mint.","/menu/lemonade.webp"]':
    "/menu/dish-passion-fruit-lemonade-1-bec56d4e.webp",
  '["Virgin pineapple coconut cooler · 330 ml",350,"Pineapple and coconut with condensed milk, poured over ice without added alcohol.","/menu/lemonade.webp"]':
    "/menu/dish-pi-a-colada-cocktail-1-38aaaf15.webp",
  '["Raspberry Fizz Lemonade · 330 ml",300,"Raspberry and strawberry fizz with lime and mint.","/menu/lemonade.webp"]':
    "/menu/dish-raspberry-fizz-lemonade-1-41bf0973.webp",
  '["Tropical Cocktail · 330 ml",300,"A mango cooler with chocolate, lemon and a fresh mint finish.","/menu/lemonade.webp"]':
    "/menu/dish-tropical-cocktail-1-1fe5dde2.webp",
  '["Fresh Grapefruit Juice 200 ml",300,"Fresh grapefruit juice, served chilled.","/menu/lemonade.webp"]':
    "/menu/dish-freshly-squeezed-grapefruit-juice-1-e00fe12d.webp",
  '["Fresh Orange Juice 200 ml",300,"Fresh orange juice, served chilled.","/menu/lemonade.webp"]':
    "/menu/dish-freshly-squeezed-orange-juice-1-fd8df88b.webp",
  '["Apple Juice · 950 ml",450,"A chilled serving of apple juice.","/menu/lemonade.webp"]':
    "/menu/dish-apple-juice-1-0b19b678.webp",
  '["Mango Juice · 950 ml",450,"A chilled serving of mango juice.","/menu/lemonade.webp"]':
    "/menu/dish-mango-juice-1-3b4c7b6c.webp",
  '["Coca-Cola 0,5 · 500 ml",150,"Chilled Coca-Cola, served in the listed bottle size.","/menu/lemonade.webp"]':
    "/menu/dish-pepsi-2l-1-44c271de.webp",
  '["Sprite 0,5 · 500 ml",150,"Chilled Sprite, served in the listed bottle size.","/menu/lemonade.webp"]':
    "/menu/dish-coca-cola-0-5-1-60f5c67b.webp",
  '["Dorna sparkling water · 500 ml",150,"Chilled Dorna sparkling water.","/menu/lemonade.webp"]':
    "/menu/dish-fanta-0-5-1-058ba012.webp",
  '["Dorna still water · 500 ml",150,"Chilled Dorna still water.","/menu/lemonade.webp"]':
    "/menu/dish-dorna-carbo-0-5-1-6b639b6c.webp",
  '["Glühwein · 220 ml",250,"Red wine warmed with cherry, apple, citrus and spices. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-gl-hwein-1-7b8b0d0f.webp",
  '["Blackcurrant Tea · 400 ml",350,"A warm blackcurrant infusion with orange and mint.","/menu/tea.webp"]':
    "/menu/dish-blackcurrant-tea-1-d0eac386.webp",
  '["Sea Buckthorn Tea · 400 ml",350,"A warm sea buckthorn and peach infusion with citrus and anise.","/menu/tea.webp"]':
    "/menu/dish-sea-buckthorn-tea-2-ef5711a8.webp",
  '["Signature Mint Tea · 400 ml",350,"An aromatic herbal infusion with honey, currants, lime and warm spices.","/menu/tea.webp"]':
    "/menu/dish-signature-mint-tea-1-887cc605.webp",
  '["Almond Hot Cocoa · 250 ml",250,"Warm cocoa made with almond drink and a chocolate finish.","/menu/coffee.webp"]':
    "/menu/dish-almond-hot-cocoa-1-0ec2e10a.webp",
  '["Almond Latte · 250 ml",250,"Espresso softened with steamed almond drink.","/menu/coffee.webp"]':
    "/menu/dish-almond-latte-1-0253859c.webp",
  '["Latte · 250 ml",200,"Espresso with plenty of steamed milk.","/menu/coffee.webp"]':
    "/menu/dish-coffee-latte-1-76cde390.webp",
  '["Espresso · 30 ml",150,"A short, freshly brewed coffee.","/menu/coffee.webp"]':
    "/menu/dish-espresso-1-18af814f.webp",
  '["Hot Cocoa · 250 ml",200,"A warm milk and cocoa drink with a chocolate finish.","/menu/coffee.webp"]':
    "/menu/dish-hot-cocoa-1-05e6b71f.webp",
  '["Americano · 100 ml",150,"Espresso lengthened with hot water.","/menu/coffee.webp"]':
    "/menu/dish-americano-1-b6e991a0.webp",
  '["Cappuccino · 150 ml",200,"Espresso topped with steamed milk and light foam.","/menu/coffee.webp"]':
    "/menu/dish-cappuccino-1-9ed71327.webp",
  '["Red Wine · 1000 ml",650,"A serving of red table wine. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-red-wine-1-59dac068.webp",
  '["Rosé Wine · 1000 ml",650,"A serving of rose table wine. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-ros-wine-1-e49bd011.webp",
  '["White Wine · 1000 ml",650,"A serving of white table wine. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-white-wine-1-0587b066.webp",
  '["Chişinău Draft Beer · 1000 ml",350,"A sharing serving of Chisinau draft beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-chi-in-u-draft-beer-1-7c4b3182.webp",
  '["Chișinău Light Beer · 500 ml",250,"A chilled Chisinau light beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-chi-in-u-light-beer-1-ecfe4ce4.webp",
  '["Chișinău Light Beer · 2250 ml",400,"A chilled Chisinau light beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-chi-in-u-light-beer-1-135745db.webp",
  '["Corona Extra · 355 ml",400,"A chilled Corona Extra beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-corona-extra-1-e05e6bcb.webp",
  '["Efes Non-Alcoholic · 500 ml",250,"A chilled Efes beer marketed as non-alcoholic; check the bottle for alcohol content.","/menu/beer.webp"]':
    "/menu/dish-efes-non-alcoholic-1-d3bfc259.webp",
  '["Efes Pilsner Beer · 500 ml",250,"A chilled Efes pilsner. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-efes-pilsner-beer-1-7df0a353.webp",
  '["Finch Beer · 500 ml",250,"A chilled Finch beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-finch-beer-1-74fa6ae2.webp",
  '["Franziskaner Weissbier · 500 ml",450,"A chilled Franziskaner wheat beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-franziskaner-weissbier-1-3b8dac8d.webp",
  '["Kozel Černý Beer · 500 ml",250,"A chilled Kozel dark beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-kozel-ern-beer-1-6316c12a.webp",
  '["Kozel Svetly · 500 ml",250,"A chilled Kozel light lager. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-kozel-svetly-1-dbccec99.webp",
  '["Timișoreana · 500 ml",250,"A chilled Timisoreana beer. Contains alcohol.","/menu/beer.webp"]':
    "/menu/dish-timi-oreana-1-4a06a278.webp",
  '["Bostavan Chardonnay White Dry Wine · 750 ml",850,"A bottle of dry Bostavan Chardonnay. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-bostavan-chardonnay-white-dry-wine-1-2ba74f7e.webp",
  '["Bostavan Merlot Red Dry Wine · 750 ml",850,"A bottle of dry Bostavan Merlot. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-bostavan-merlot-red-dry-wine-1-9b36365e.webp",
  '["Bostavan Muscat Rosé · 750 ml",850,"A bottle of Bostavan Muscat rose. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-bostavan-muscat-ros-1-0c254d33.webp",
  '["PURCARI Nocturne Cabernet Sauvignon Red Sec · 750 ml",1350,"A bottle of dry Purcari Cabernet Sauvignon. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-purcari-nocturne-cabernet-sauvignon-red-sec-1-62837af8.webp",
  '["Purcari Nocturne Pinot Grigio Dry Wine · 750 ml",1350,"A bottle of dry Purcari Pinot Grigio. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-purcari-nocturne-pinot-grigio-dry-wine-1-26184e79.webp",
  '["Purcari Nocturne Rose sec · 750 ml",1350,"A bottle of dry Purcari rose. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-purcari-nocturne-rose-sec-1-50466b42.webp",
  '["Purcari Nocturne Sauvignon Blanc Dry Wine · 750 ml",1350,"A bottle of dry Purcari Sauvignon Blanc. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-purcari-nocturne-sauvignon-blanc-dry-wine-1-39620d32.webp",
  '["Cricova Crisecco Brut · 750 ml",950,"A bottle of Cricova brut sparkling wine. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-cricova-crisecco-brut-1-92f8c7e9.webp",
  '["Cricova Lacrima Dulce · 750 ml",950,"A bottle of Cricova Lacrima Dulce wine. Contains alcohol.","/menu/wine.webp"]':
    "/menu/dish-cricova-lacrima-dulce-1-2661d4a1.webp",
  '["Flatbread with Butter and Garlic Sheep Cheese · 60 g (1 pc)",100,"Warm flatbread with sheep cheese and garlic butter.","/menu/bread.webp"]':
    "/menu/dish-flatbread-with-butter-and-garlic-sheep-cheese-1-79c02139.webp",
  '["Flatbread with Butter and Sheep Cheese · 60 g (1 pc)",100,"Warm flatbread with butter and sheep cheese.","/menu/bread.webp"]':
    "/menu/dish-flatbread-with-butter-and-sheep-cheese-1-a499de4b.webp",
  '["Bread Rusks · 50 g",100,"Crisp wheat bread bites for the table.","/menu/bread.webp"]':
    "/menu/dish-bread-rusks-1-e79a7275.webp",
  '["Hot Bread · 150 g",100,"Warm mixed-grain bread with seeds and olive oil.","/menu/bread.webp"]':
    "/menu/dish-hot-bread-1-8cb6c993.webp",
  '["Ciabatta · 100 g",100,"A portion of rustic wheat ciabatta.","/menu/bread.webp"]':
    "/menu/dish-ciabatta-1-a006558d.webp",
  '["Focaccia · 220 g",150,"Soft olive oil bread for sharing.","/menu/bread.webp"]':
    "/menu/dish-focaccia-1-3d42673b.webp",
  '["Mayonnaise · 50 g",100,"A small pot of creamy mayonnaise.","/menu/sauces.webp"]':
    "/menu/dish-mayonnaise-1-000fa824.webp",
  '["Tartar Sauce · 50g",100,"A creamy pickle and caper dip with herbs and mustard.","/menu/sauces.webp"]':
    "/menu/dish-tartar-sauce-1-ba24c42d.webp",
  '["Sour Cream · 50 g",100,"A little sour cream to serve alongside your dish.","/menu/sauces.webp"]':
    "/menu/dish-sour-cream-1-7f3c09c9.webp",
  '["Ketchup · 50 g",100,"A small pot of tomato ketchup.","/menu/sauces.webp"]':
    "/menu/dish-ketchup-1-938b6e38.webp",
  '["Zesty sauce · 50 g",100,"A creamy tomato and pickle dip with onion.","/menu/sauces.webp"]':
    "/menu/dish-zesty-sauce-1-6137b599.webp",
};

export function dishPhotoPath(product: Product): string | null {
  const path = product.image_path;
  if (!path) return null;
  let name = product.names.en;
  const suffix = name.lastIndexOf(" — ");
  if (suffix >= 0 && categories.has(name.slice(suffix + 3)))
    name = name.slice(0, suffix);
  const signature = JSON.stringify([
    name,
    product.price_bani,
    product.descriptions.en,
    path,
  ]);
  return photoAliases[signature] ?? path;
}
