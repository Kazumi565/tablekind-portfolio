import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { menuEntries } from "../src/menuCatalog.ts";
import { previewMenu } from "../src/previewMenu.ts";

const menu = JSON.parse(
  await readFile(
    new URL("../../backend/src/main/resources/demo/menu.json", import.meta.url),
    "utf8",
  ),
);

test("menu assets, identifiers and categories are complete", async () => {
  assert.equal(new Set(menu.items.map((d) => d.id)).size, menu.items.length);
  assert.equal(new Set(menu.categories).size, menu.categories.length);
  for (const dish of menu.items) {
    assert.ok(menu.categories.includes(dish.category), dish.name);
    assert.ok(Number.isSafeInteger(dish.price) && dish.price > 0, dish.name);
    assert.ok(
      dish.description.length > 0 && dish.description.length < 500,
      dish.name,
    );
    assert.match(dish.image, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    await access(new URL(`../public/menu/${dish.image}.webp`, import.meta.url));
  }
});

test("prepared dinner preserves exact items, diner responsibility and EUR cents", () => {
  const ordered = menu.items.filter((d) => d.owner >= 0);
  assert.deepEqual(
    ordered.map((d) => [d.name, d.price, d.owner]).sort(),
    [
      ["Burger", 1200, 0],
      ["Pasta", 1000, 1],
      ["Salad", 900, 2],
      ["Shared starter", 701, 0],
    ].sort(),
  );
  assert.equal(
    ordered.reduce((sum, d) => sum + d.price, 0),
    3801,
  );
});

test("every included source category reaches at least 70 percent independently", () => {
  assert.equal(menu.coverage.length, 17);
  for (const category of menu.coverage) {
    const selected = menu.items.filter(
      (d) => d.sourceCategory === category.sourceName,
    );
    assert.ok(
      selected.length >= Math.ceil(category.sourceCount * 0.7),
      `${category.sourceName}: ${selected.length}/${category.sourceCount}`,
    );
    assert.equal(
      new Set(selected.map((d) => d.sourceName + "|" + d.sourcePortion)).size,
      selected.length,
      category.sourceName,
    );
    assert.equal(selected.length, category.selectedCount);
  }
});

test("overlapping demo dishes are replaced and shared-category dishes appear once", () => {
  const entries = menuEntries(previewMenu);
  for (const name of [
    "Margherita",
    "Pepperoni",
    "Berry cheesecake",
    "Tiramisu",
  ]) {
    assert.equal(
      menu.items.filter(
        (d) =>
          d.name
            .split(" · ")[0]
            .toLowerCase()
            .replace(/ pizza$/, "") === name.toLowerCase(),
      ).length,
      1,
      name,
    );
  }
  const mojito = entries.filter(
    (e) => e.product.names.en === "Mojito Cocktail · 330 ml",
  );
  assert.equal(mojito.length, 1);
  assert.deepEqual(mojito[0].categoryIds.sort(), ["Bar", "Cocktails"]);
  assert.ok(entries.length < previewMenu.products.length);
  for (const category of previewMenu.categories) {
    assert.equal(
      entries.filter((e) => e.categoryIds.includes(category.id)).length,
      previewMenu.products.filter((p) => p.category_id === category.id).length,
      category.id,
    );
  }
});

test("deduplication preserves portions, prices, recipes and modifier choices", () => {
  const original = previewMenu.products.find((p) =>
    p.names.en.startsWith("Pepperoni Pizza ·"),
  );
  const variations = [
    {
      ...original,
      id: "different-price",
      price_bani: original.price_bani + 50,
    },
    {
      ...original,
      id: "different-portion",
      names: { en: "Pepperoni Pizza · 900 g" },
    },
    {
      ...original,
      id: "different-recipe",
      descriptions: { en: "A different recipe" },
    },
    {
      ...original,
      id: "different-modifiers",
      modifierGroups: [
        {
          id: "size",
          names: { en: "Size" },
          min_select: 1,
          max_select: 1,
          options: [],
        },
      ],
    },
  ];
  const input = { ...previewMenu, products: [original, ...variations] };
  const before = JSON.stringify(input);
  assert.equal(menuEntries(input).length, 5);
  assert.equal(JSON.stringify(input), before);
});

test("shared categories retain an orderable original product ID and version", () => {
  const original = previewMenu.products.find(
    (p) => p.names.en === "Mojito Cocktail · 330 ml — Cocktails",
  );
  const unavailable = {
    ...original,
    id: "a-unavailable",
    version: 9,
    available: false,
    category_id: "Bar",
    names: { en: "Mojito Cocktail · 330 ml — Bar" },
  };
  const entries = menuEntries({
    ...previewMenu,
    products: [unavailable, original],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].product.id, original.id);
  assert.equal(entries[0].product.version, original.version);
  assert.equal(entries[0].product.available, true);
  assert.deepEqual(entries[0].categoryIds.sort(), ["Bar", "Cocktails"]);
});

test("replacement of legacy demo aliases does not hide other restaurants' variants", () => {
  const rich = previewMenu.products.find((p) =>
    p.names.en.startsWith("Pepperoni Pizza ·"),
  );
  const plain = {
    ...rich,
    id: "different-restaurant-variant",
    names: { en: "Pepperoni" },
    price_bani: 1150,
  };
  assert.equal(
    menuEntries({ ...previewMenu, products: [plain, rich] }).length,
    2,
  );
});
