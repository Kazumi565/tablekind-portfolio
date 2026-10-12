import { readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";

const fixture = JSON.parse(
  await readFile(
    new URL("../../backend/src/main/resources/demo/menu.json", import.meta.url),
    "utf8",
  ),
);
const preview = {
  categories: fixture.categories.map((name, index) => ({
    id: name,
    names: { en: name },
    sort_order: index,
  })),
  products: fixture.items.map((dish) => ({
    id: dish.id,
    category_id: dish.category,
    names: { en: dish.name },
    descriptions: { en: dish.description },
    price_bani: dish.price,
    image_path: `/menu/${dish.image}.webp`,
    allergens: dish.allergens,
    dietary_labels: dish.dietaryLabels,
    available: true,
    version: 1,
    modifierGroups: [],
  })),
};
const contents = await format(
  `import type { Menu } from "./types";\n\nexport const previewMenu: Menu = ${JSON.stringify(preview, null, 2)};\n`,
  { parser: "typescript" },
);
const target = new URL("../src/previewMenu.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== contents)
    throw new Error("Menu preview is out of date. Run npm run menu:sync.");
} else {
  await writeFile(target, contents);
}
console.log(
  `Menu synchronized: ${preview.products.length} dishes in ${preview.categories.length} categories.`,
);
