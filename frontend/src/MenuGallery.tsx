import { useEffect, useState } from "react";
import { ArrowRight, Leaf, Plus, Search, UtensilsCrossed } from "lucide-react";
import type { Menu, Names, Product } from "./types";
import { useMoney } from "./Currency";
import { menuEntries } from "./menuCatalog";
import { dishPhotoPath } from "./menuPhotos";
import "./menuExperience.css";

const label = (names: Names, lang: string) =>
  names[lang as keyof Names] || names.en;

export function dishHeading(name: string) {
  return name.split(" · ")[0];
}

export function dishPortion(name: string) {
  const portion = name.split(" · ")[1]?.split(" — ")[0] ?? "";
  if (/^\d+(?:\s*\/\s*\d+)+\s*g$/.test(portion)) {
    return `${portion
      .replace(/g$/, "")
      .split("/")
      .reduce((total, part) => total + Number(part.trim()), 0)} g total`;
  }
  return portion;
}

export function DishPhoto({
  product,
  className = "",
  priority = false,
}: {
  product: Product;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const path = dishPhotoPath(product);
  useEffect(() => setFailed(false), [path]);
  return path && /^\/menu\/[a-z0-9-]+\.webp$/.test(path) && !failed ? (
    <img
      className={`dish-photo ${className}`}
      src={path}
      alt={product.names.en}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      width="800"
      height="600"
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`dish-photo photo-fallback ${className}`}
      aria-label="Dish photograph unavailable"
    >
      <UtensilsCrossed size={42} />
    </div>
  );
}

export function MenuGallery({
  menu,
  lang = "en",
  disabled = false,
  onSelect,
  preview = false,
}: {
  menu: Menu;
  lang?: string;
  disabled?: boolean;
  onSelect: (product: Product) => void;
  preview?: boolean;
}) {
  const { money } = useMoney();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vegetarian, setVegetarian] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => setVisibleCount(24), [query, category, vegetarian]);
  const categories = [...menu.categories].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const categoryOrder = new Map(categories.map((c) => [c.id, c.sort_order]));
  const dishNames = new Intl.Collator(
    lang === "ro" || lang === "ru" ? lang : "en",
    {
      numeric: true,
      sensitivity: "base",
    },
  );
  const activeCategory = categories.find((c) => c.id === category);
  const entries = menuEntries(menu);
  const products = entries
    .filter(
      (entry) =>
        !activeCategory || entry.categoryIds.includes(activeCategory.id),
    )
    .map((entry) => entry.product)
    .filter(
      (p) =>
        (!vegetarian ||
          p.dietary_labels.some((d) => /^(vegetarian|vegan)$/i.test(d))) &&
        `${label(p.names, lang)} ${label(p.descriptions, lang)}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        (categoryOrder.get(a.category_id) ?? Number.MAX_SAFE_INTEGER) -
          (categoryOrder.get(b.category_id) ?? Number.MAX_SAFE_INTEGER) ||
        dishNames.compare(label(a.names, lang), label(b.names, lang)) ||
        a.id.localeCompare(b.id),
    );
  const photographed = entries
    .map((entry) => entry.product)
    .filter(
      (p) =>
        p.available &&
        /^\/menu\/[a-z0-9-]+\.webp$/.test(dishPhotoPath(p) ?? ""),
    );
  const hero =
    photographed.find((p) =>
      /^Margherita(?: Pizza)?(?: ·|$)/i.test(p.names.en),
    ) ?? photographed[0];
  const freshDish = photographed.find(
    (p) =>
      dishPhotoPath(p) !== (hero && dishPhotoPath(hero)) &&
      /salad/i.test(p.names.en),
  );
  const categoryCounts = new Map(
    categories.map((c) => [
      c.id,
      entries.filter((entry) => entry.categoryIds.includes(c.id)).length,
    ]),
  );
  return (
    <section
      className="restaurant-menu menu-experience"
      aria-label="Restaurant menu"
    >
      <div className={`dining-hero ${hero ? "with-photo" : ""}`}>
        <div className="dining-hero-copy">
          <span className="menu-kicker">A LITTLE MORE TOGETHER</span>
          <h2>
            Good food.
            <br />
            Better <em>company.</em>
          </h2>
          <p>
            Find your favourite. Try something new.
            <br /> Make a little room for sharing.
          </p>
          <div className="hero-menu-actions">
            <a href="#menu-dishes" className="button hero-menu-link">
              Find your next favourite <ArrowRight size={18} />
            </a>
            <span>{entries.length} dishes. Plenty to love.</span>
          </div>
          <div className="hero-footnote">
            <UtensilsCrossed size={15} /> Made for your kind of table
          </div>
        </div>
        {hero && (
          <div className="dining-hero-visual">
            <DishPhoto key={hero.image_path} product={hero} priority />
            <div className="hero-food-caption">
              <span>
                The simple things, done well
                <strong>
                  {dishHeading(label(hero.names, lang))} ·{" "}
                  {money(hero.price_bani)}
                </strong>
              </span>
              <button
                aria-label={`View featured ${label(hero.names, lang)}`}
                disabled={disabled || !hero.available}
                onClick={() => onSelect(hero)}
              >
                <ArrowRight size={21} />
              </button>
            </div>
            {freshDish && (
              <div className="hero-fresh-postcard">
                <DishPhoto key={freshDish.image_path} product={freshDish} />
                <span>
                  A little fresh.
                  <br />A little indulgent.
                </span>
              </div>
            )}
            <div className="hero-table-seal" aria-hidden="true">
              <Leaf size={22} />
              <span>
                Pull up
                <br />a chair
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="menu-intro" id="menu-dishes">
        <div>
          <span className="menu-kicker">FIND YOUR NEXT FAVOURITE</span>
          <h2>Something for every appetite.</h2>
        </div>
        <p>
          Pick a classic or try something new.
          <br />
          The best bites are the ones you share.
        </p>
      </div>
      <div className="menu-layout">
        <div className="menu-tools">
          <label className="menu-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Search menu"
              placeholder="Find a dish, an ingredient, a little inspiration…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="vegetarian-filter"
            aria-pressed={vegetarian}
            onClick={() => setVegetarian(!vegetarian)}
          >
            <Leaf size={17} /> Vegetarian
            <span className="menu-filter-check" aria-hidden="true">
              {vegetarian ? "✓" : ""}
            </span>
          </button>
          <label className="mobile-menu-category">
            <span className="sr-only">Browse a category</span>
            <select
              aria-label="Menu category"
              value={activeCategory?.id ?? ""}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All dishes ({entries.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c.names, lang)} ({categoryCounts.get(c.id)})
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="menu-rail" aria-label="Menu categories">
          <div className="menu-category-buttons">
            <button
              aria-pressed={!activeCategory}
              onClick={() => setCategory("")}
            >
              <span>All dishes</span>
              <span>{entries.length.toString().padStart(2, "0")}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                <span>{label(c.names, lang)}</span>
                <span>
                  {(categoryCounts.get(c.id) ?? 0).toString().padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
        </nav>
        <div className="menu-content">
          <p className="menu-result-count" role="status">
            {products.length} {products.length === 1 ? "dish" : "dishes"}
            {activeCategory
              ? ` · ${label(activeCategory.names, lang)}`
              : " · A little of everything"}
          </p>
          <div className="photo-menu-grid">
            {products.slice(0, visibleCount).map((p) => (
              <article className="photo-menu-card" key={p.id}>
                <div className="dish-visual">
                  <DishPhoto key={p.image_path} product={p} />
                  {p.dietary_labels.some((d) =>
                    /^(vegetarian|vegan)$/i.test(d),
                  ) && (
                    <span className="dish-badge">
                      <Leaf size={12} /> Vegetarian
                    </span>
                  )}
                </div>
                <div className="dish-copy">
                  <h3>{dishHeading(label(p.names, lang))}</h3>
                  {dishPortion(label(p.names, lang)) && (
                    <span className="dish-portion">
                      {dishPortion(label(p.names, lang))}
                    </span>
                  )}
                  <p>{label(p.descriptions, lang)}</p>
                  <div className="dish-bottom">
                    <strong>{money(p.price_bani)}</strong>
                    <button
                      className="dish-add"
                      aria-label={`${preview ? "View" : "Order"} ${label(p.names, lang)}`}
                      disabled={disabled || !p.available}
                      onClick={() => onSelect(p)}
                    >
                      {p.available ? (
                        <>
                          <Plus size={17} />
                          <span>{preview ? "View dish" : "Order"}</span>
                        </>
                      ) : (
                        "Unavailable"
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {products.length > visibleCount && (
            <div className="menu-load-more">
              <button onClick={() => setVisibleCount((n) => n + 24)}>
                Show more dishes{" "}
                <span>({products.length - visibleCount} remaining)</span>
              </button>
            </div>
          )}
          {!products.length && (
            <div className="menu-empty">
              <Search size={28} />
              <h3>No dishes found</h3>
              <p>Try another craving or browse the full menu.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setVegetarian(false);
                }}
              >
                Show all dishes
              </button>
            </div>
          )}
          <p className="menu-allergen-note">
            Representative food photography; ingredients and portions may differ.
            Ask your waiter about ingredients, allergens and cross-contact.{" "}
            <a href="/menu/photo-credits.html" target="_blank" rel="noreferrer">
              Photo credits and licences
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
