import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

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
