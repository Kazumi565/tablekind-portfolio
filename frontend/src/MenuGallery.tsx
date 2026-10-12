import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChefHat,
  Leaf,
  Plus,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import type { Menu, Names, Product } from "./types";
import { useMoney } from "./Currency";

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
  const path = product.image_path;
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
  const activeCategory = categories.find((c) => c.id === category);
  const products = menu.products.filter(
    (p) =>
      (!activeCategory || p.category_id === activeCategory.id) &&
      (!vegetarian ||
        p.dietary_labels.some((d) => /^(vegetarian|vegan)$/i.test(d))) &&
      `${label(p.names, lang)} ${label(p.descriptions, lang)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const photographed = menu.products.filter(
    (p) =>
      p.available &&
      p.image_path &&
      /^\/menu\/[a-z0-9-]+\.webp$/.test(p.image_path),
  );
  const hero =
    photographed.find((p) => p.names.en === "Margherita") ?? photographed[0];
  return (
    <section className="restaurant-menu" aria-label="Restaurant menu">
      <div className={`dining-hero ${hero ? "with-photo" : ""}`}>
        <div className="dining-hero-copy">
          <span className="menu-kicker">
            <span /> THE GOOD PART OF GETTING TOGETHER
          </span>
          <h2>
            Good food.
            <br />
            <em>Better together.</em>
          </h2>
          <p>
            One more slice. Something to share. Find your favourites and make a
            meal of it.
          </p>
          <a href="#menu-dishes" className="button hero-menu-link">
            Explore the menu <ArrowRight size={17} />
          </a>
          <div className="hero-footnote">
            <UtensilsCrossed size={15} /> Made for your kind of table
          </div>
        </div>
        {hero && (
          <div className="dining-hero-visual">
            <DishPhoto key={hero.image_path} product={hero} priority />
            <span className="hero-food-caption">
              <ChefHat size={18} />
              <span>
                A little something from our menu
                <strong>{label(hero.names, lang)}</strong>
              </span>
            </span>
          </div>
        )}
      </div>
      <div className="menu-intro" id="menu-dishes">
        <div>
          <span className="menu-kicker">FIND YOUR NEXT FAVOURITE</span>
          <h2>A menu for every mood.</h2>
        </div>
        <p>
          Pick a classic or try something new.
          <br />
          The best bites are the ones you share.
        </p>
      </div>
      <div className="menu-layout">
        <aside className="menu-rail" aria-label="Menu categories">
          <span className="menu-kicker">ON THE MENU</span>
          <label className="mobile-menu-category">
            <span>Browse a category</span>
            <select
              aria-label="Menu category"
              value={activeCategory?.id ?? ""}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All dishes ({menu.products.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c.names, lang)} (
                  {menu.products.filter((p) => p.category_id === c.id).length})
                </option>
              ))}
            </select>
          </label>
          <div className="menu-category-buttons">
            <button
              aria-pressed={!activeCategory}
              onClick={() => setCategory("")}
            >
              <span>All dishes</span>
              <span>{menu.products.length.toString().padStart(2, "0")}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                <span>{label(c.names, lang)}</span>
                <span>
                  {menu.products
                    .filter((p) => p.category_id === c.id)
                    .length.toString()
                    .padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
          <div className="menu-sharing-note">
            <UtensilsCrossed size={22} />
            <strong>Sharing tastes better.</strong>
            <p>Order for the table, then decide together who covers what.</p>
          </div>
        </aside>
        <div className="menu-content">
          <div className="menu-tools">
            <label className="menu-search">
              <Search size={18} />
              <input
                type="search"
                aria-label="Search menu"
                placeholder="What are you craving?"
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
            </button>
          </div>
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
            Photos illustrate dish styles and may represent several menu items.
            Ask your waiter about ingredients, allergens and cross-contact.
          </p>
        </div>
      </div>
    </section>
  );
}
