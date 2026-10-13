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
// Existing dinners retain their original database rows and image paths. Match
// the complete seeded recipe before presenting its corresponding new photo.
const aliases = Object.fromEntries(
  fixture.items
    .filter((dish) => dish.legacyImage && dish.image !== dish.legacyImage)
    .map((dish) => [
      JSON.stringify([
        dish.name.replace(/ — [^—]+$/, ""),
        dish.price,
        dish.description,
        `/menu/${dish.legacyImage}.webp`,
      ]),
      `/menu/${dish.image}.webp`,
    ]),
);
const photoContents = await format(
  `import type { Product } from "./types";

const categories = new Set(${JSON.stringify(fixture.categories)});
const photoAliases: Record<string, string> = ${JSON.stringify(aliases, null, 2)};

export function dishPhotoPath(product: Product): string | null {
  const path = product.image_path;
  if (!path) return null;
  let name = product.names.en;
  const suffix = name.lastIndexOf(" — ");
  if (suffix >= 0 && categories.has(name.slice(suffix + 3))) name = name.slice(0, suffix);
  const signature = JSON.stringify([name, product.price_bani, product.descriptions.en, path]);
  return photoAliases[signature] ?? path;
}
`,
  { parser: "typescript" },
);
const photoTarget = new URL("../src/menuPhotos.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== contents)
    throw new Error("Menu preview is out of date. Run npm run menu:sync.");
  if ((await readFile(photoTarget, "utf8")) !== photoContents)
    throw new Error("Menu photos are out of date. Run npm run menu:sync.");
} else {
  await writeFile(target, contents);
  await writeFile(photoTarget, photoContents);
}
console.log(
  `Menu synchronized: ${preview.products.length} dishes in ${preview.categories.length} categories.`,
);
