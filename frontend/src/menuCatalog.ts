import type { Menu, Product } from "./types";

export type MenuEntry = { product: Product; categoryIds: string[] };

const legacyDuplicates = new Map([
  ["Margherita", "Margherita Pizza · 380 g"],
  ["Pepperoni", "Pepperoni Pizza · 475 g"],
  ["Berry cheesecake", "Berry Cheesecake · 175 g"],
  ["Tiramisu", "Tiramisu · 200 g"],
]);

// Old dinners keep their product IDs and financial records. Their gallery can
// still use the richer replacement instead of offering both catalog versions.
export function menuEntries(menu: Menu): MenuEntry[] {
  const names = new Set(menu.products.map((p) => p.names.en));
  const legacyDinner = [
    ["Burger", 1200],
    ["Pasta", 1000],
    ["Salad", 900],
    ["Shared starter", 701],
  ].every(([name, price]) =>
    menu.products.some((p) => p.names.en === name && p.price_bani === price),
  );
  const categoryNames = new Set(
    menu.categories.flatMap((c) => Object.values(c.names)),
  );
  const clean = (name: string) => {
    const suffix = name.lastIndexOf(" — ");
    return (
      suffix >= 0 && categoryNames.has(name.slice(suffix + 3))
        ? name.slice(0, suffix)
        : name
    )
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/\s+/g, " ")
      .trim();
  };
  const groups = new Map<string, MenuEntry>();
  for (const product of [...menu.products].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const replacement = legacyDuplicates.get(product.names.en);
    if (legacyDinner && replacement && names.has(replacement)) continue;
    const key = JSON.stringify([
      Object.entries(product.names)
        .sort()
        .map(([lang, name]) => [lang, clean(name ?? "")]),
      product.price_bani,
      product.descriptions,
      [...product.allergens].sort(),
      [...product.dietary_labels].sort(),
      product.modifierGroups,
    ]);
    const existing = groups.get(key);
    if (existing) {
      if (!existing.categoryIds.includes(product.category_id))
        existing.categoryIds.push(product.category_id);
      if (!existing.product.available && product.available)
        existing.product = product;
    } else {
      groups.set(key, { product, categoryIds: [product.category_id] });
    }
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    product: {
      ...entry.product,
      names: Object.fromEntries(
        Object.entries(entry.product.names).map(([lang, name]) => {
          const suffix = name?.lastIndexOf(" — ") ?? -1;
          return [
            lang,
            suffix >= 0 && categoryNames.has(name!.slice(suffix + 3))
              ? name!.slice(0, suffix)
              : name,
          ];
        }),
      ) as Product["names"],
    },
  }));
}
