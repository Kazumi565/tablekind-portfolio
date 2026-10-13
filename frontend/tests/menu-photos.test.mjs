import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dishPhotoPath } from "../src/menuPhotos.ts";
import { menuEntries } from "../src/menuCatalog.ts";
import { previewMenu } from "../src/previewMenu.ts";

const fixture = JSON.parse(
  await readFile(
    new URL("../../backend/src/main/resources/demo/menu.json", import.meta.url),
    "utf8",
  ),
);
const provenance = JSON.parse(
  await readFile(
    new URL("../../docs/hackathon/MENU-PHOTOS.json", import.meta.url),
    "utf8",
  ),
);
const sourceRows = fixture.items.filter((dish) => dish.sourceCategory);
const productFor = (dish) =>
  structuredClone(
    previewMenu.products.find((product) => product.id === dish.id),
  );
const legacyProductFor = (dish) => ({
  ...productFor(dish),
  id: randomUUID(),
  version: 17,
  image_path: `/menu/${dish.legacyImage}.webp`,
});
const cleanName = (name) => name.replace(/ — [^—]+$/, "");

test("every selected source row resolves in fresh and existing dinners without altering products", () => {
  assert.equal(sourceRows.length, 216);
  for (const dish of sourceRows) {
    const expected = `/menu/${dish.image}.webp`;
    for (const product of [productFor(dish), legacyProductFor(dish)]) {
      const before = structuredClone(product);
      assert.equal(dishPhotoPath(product), expected, dish.name);
      assert.deepEqual(product, before, dish.name);
    }
  }
});

test("known category aliases and cleaned gallery names share the corresponding photo", () => {
  const dish = sourceRows.find((row) => row.sourceName === "Mojito Cocktail");
  assert.ok(dish);
  for (const category of ["Bar", "Cocktails"]) {
    const product = legacyProductFor(dish);
    product.names.en = `${cleanName(dish.name)} — ${category}`;
    assert.equal(dishPhotoPath(product), `/menu/${dish.image}.webp`);
  }
  const cleaned = legacyProductFor(dish);
  cleaned.names.en = cleanName(dish.name);
  assert.equal(dishPhotoPath(cleaned), `/menu/${dish.image}.webp`);
  const unrelated = legacyProductFor(dish);
  unrelated.names.en = `${cleanName(dish.name)} — Chef's recipe`;
  assert.equal(dishPhotoPath(unrelated), unrelated.image_path);
});

test("custom recipes, prices and photos retain their paths, as do all original dishes", () => {
  const dish = sourceRows.find((row) => row.sourceName === "Pepperoni Pizza");
  assert.ok(dish);
  const variations = [
    { price_bani: dish.price + 50 },
    { descriptions: { en: "A customised recipe with different ingredients." } },
    { names: { en: "Chef's pepperoni pizza" } },
    { image_path: "/menu/our-own-pepperoni.webp" },
    { image_path: null },
  ];
  for (const variation of variations) {
    const product = { ...legacyProductFor(dish), ...variation };
    const before = structuredClone(product);
    assert.equal(dishPhotoPath(product), product.image_path);
    assert.deepEqual(product, before);
  }
  const originals = fixture.items.filter((row) => !row.sourceCategory);
  assert.equal(originals.length, 8);
  for (const original of originals) {
    const product = productFor(original);
    assert.equal(dishPhotoPath(product), `/menu/${original.image}.webp`);
  }
});

test("pizza recipes have distinct photo content and the consolidated gallery keeps complete coverage", () => {
  const pizzas = sourceRows.filter((dish) => dish.category === "Pizza");
  const images = new Map(provenance.images.map((image) => [image.path, image]));
  assert.equal(pizzas.length, 10);
  assert.equal(
    new Set(pizzas.map((dish) => dishPhotoPath(productFor(dish)))).size,
    10,
  );
  assert.equal(
    new Set(pizzas.map((dish) => images.get(`/menu/${dish.image}.webp`).sha256))
      .size,
    10,
  );
  const entries = menuEntries(previewMenu);
  assert.equal(entries.length, 203);
  assert.equal(
    entries.filter((entry) =>
      dishPhotoPath(entry.product).startsWith("/menu/dish-"),
    ).length,
    195,
  );
});

test("photo provenance covers every source row and verifies complete bounded local WebP files", async () => {
  assert.equal(provenance.selectedSourceRows, sourceRows.length);
  assert.equal(provenance.distinctSourceImages, provenance.images.length);
  assert.equal(provenance.images.length, 195);
  assert.equal(provenance.originalIllustrativeRows, 8);
  assert.equal(
    new Set(provenance.entries.map((entry) => entry.fixtureId)).size,
    216,
  );
  const images = new Map(provenance.images.map((image) => [image.path, image]));
  for (const dish of sourceRows) {
    const entry = provenance.entries.find(
      (entry) => entry.fixtureId === dish.id,
    );
    assert.ok(entry, dish.name);
    assert.equal(entry.displayName, dish.name);
    assert.equal(entry.sourceName, dish.sourceName);
    assert.equal(entry.sourceCategory, dish.sourceCategory);
    assert.equal(entry.sourcePortion, dish.sourcePortion);
    assert.equal(entry.photoPath, `/menu/${dish.image}.webp`);
    assert.ok(images.has(entry.photoPath));
  }
  const files = (
    await readdir(new URL("../public/menu/", import.meta.url))
  ).filter((name) => name.startsWith("dish-"));
  assert.equal(files.length, images.size);
  const hashes = new Set();
  for (const record of provenance.images) {
    assert.match(record.path, /^\/menu\/dish-[a-z0-9-]+\.webp$/);
    const source = new URL(record.sourceUrl);
    assert.equal(source.protocol, "https:");
    assert.equal(source.hostname, "back.andys.md");
    assert.ok(source.pathname.startsWith("/image/cachewebp/catalog/andys/"));
    const buffer = await readFile(
      new URL(`../public${record.path}`, import.meta.url),
    );
    assert.equal(buffer.length, record.bytes);
    assert.ok(buffer.length > 1000 && buffer.length < 150000, record.path);
    const hash = createHash("sha256").update(buffer).digest("hex");
    assert.equal(hash, record.sha256, record.path);
    hashes.add(hash);
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
    assert.equal(buffer.readUInt32LE(4), buffer.length - 8);
    assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
    assert.equal(buffer.toString("ascii", 12, 16), "VP8 ");
    assert.deepEqual([...buffer.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    assert.deepEqual([width, height], [record.width, record.height]);
    assert.deepEqual([width, height], [600, 600]);
  }
  assert.equal(hashes.size, provenance.distinctPhotoContents);
  assert.equal(hashes.size, 189);
});
