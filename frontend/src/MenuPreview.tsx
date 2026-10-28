import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { CurrencyContext, useMoney } from "./Currency";
import {
  DishPhoto,
  MenuGallery,
  dishHeading,
  dishPortion,
} from "./MenuGallery";
import { previewMenu } from "./previewMenu";
import type { Product } from "./types";

export default function MenuPreview() {
  return (
    <CurrencyContext.Provider value="EUR">
      <Preview />
    </CurrencyContext.Provider>
  );
}

function Preview() {
  const { money } = useMoney();
  const [selected, setSelected] = useState<Product | null>(null);
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [showBasket, setShowBasket] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const count = Object.values(basket).reduce((sum, n) => sum + n, 0);
  const total = previewMenu.products.reduce(
    (sum, p) => sum + p.price_bani * (basket[p.id] || 0),
    0,
  );
  const update = (p: Product, delta: number) =>
    setBasket((previous) => ({
      ...previous,
      [p.id]: Math.max(0, Math.min(20, (previous[p.id] || 0) + delta)),
    }));
  useEffect(() => {
    if (selected || showBasket) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected, showBasket]);
  const close = () => {
    setSelected(null);
    setShowBasket(false);
  };
  return (
    <div className="menu-preview">
      <header className="dining-header">
        <a className="dining-brand" href="#">
          <span className="dining-mark">
            <UtensilsCrossed size={21} />
          </span>
          tablekind<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#menu-dishes">Our menu</a>
          <a href="#how-sharing-works">The table experience</a>
        </nav>
        <button className="preview-bag" onClick={() => setShowBasket(true)}>
          <ShoppingBag size={18} />
          <span>Your picks</span>
          <b>{count}</b>
        </button>
      </header>
      <div className="preview-ribbon">
        THE TABLEKIND MENU PREVIEW <span>·</span> Explore a fictional restaurant
        menu. Ordering and payments run in the full demo.
      </div>
      <main>
        <MenuGallery menu={previewMenu} onSelect={setSelected} preview />
        <section className="dining-story" id="how-sharing-works">
          <div>
            <span className="menu-kicker">LESS MATH. MORE MOMENTS.</span>
            <h2>
              The meal is shared.
              <br />
              <em>The choice is yours.</em>
            </h2>
            <p>
              TableKind helps friends enjoy dinner, agree on the bill and pay
              their own way.
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Find your favourites</h3>
                <p>Browse the menu and order for yourself or the table.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Make the split yours</h3>
                <p>
                  Describe who covers what. Review every amount before anyone
                  agrees.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Agree, then pay</h3>
                <p>Everyone accepts their share before paying with PayPal.</p>
              </div>
            </li>
          </ol>
        </section>
        <section className="full-demo-note">
          <strong>Want to try the whole journey?</strong>
          <p>
            The full TableKind demo includes diner consent, AI split previews
            and PayPal sandbox checkout. This hosted preview lets you explore
            the menu and plan a meal. It does not send orders or take payments.
          </p>
          <a
            href="https://github.com/Kazumi565/tablekind-portfolio"
            target="_blank"
            rel="noreferrer"
          >
            Project repository <ArrowRight size={15} />
          </a>
          <small>
            The latest hackathon changes are being prepared locally for
            publication.
          </small>
        </section>
      </main>
      <footer className="dining-footer">
        <span className="dining-brand">tablekind.</span>
        <span>Good food. Good company. A fair share.</span>
        <small>
          Fictional menu · EUR prices · Representative photography ·{" "}
          <a href="/menu/photo-credits.html" target="_blank" rel="noreferrer">
            Photo credits
          </a>
        </small>
      </footer>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <dialog
        ref={dialog}
        className="dish-dialog"
        onCancel={close}
        aria-label={selected?.names.en ?? "Your menu picks"}
      >
        <button
          className="icon dish-dialog-close"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
        {selected ? (
          <>
            <DishPhoto key={selected.id} product={selected} />
            <div className="dish-dialog-copy">
              <span className="menu-kicker">{selected.category_id}</span>
              <div className="spread">
                <h2>{dishHeading(selected.names.en)}</h2>
                <strong>{money(selected.price_bani)}</strong>
              </div>
              <span className="dish-portion">
                {dishPortion(selected.names.en)}
              </span>
              <p>{selected.descriptions.en}</p>
              <p className="dish-allergens">
                <strong>Listed allergens:</strong>{" "}
                {selected.allergens.join(", ") || "None listed"}. Ask the
                restaurant about cross-contact.
              </p>
              <button
                className="primary wide"
                disabled={(basket[selected.id] || 0) >= 20}
                onClick={() => {
                  update(selected, 1);
                  setAnnouncement(`${selected.names.en} added to your picks`);
                  close();
                }}
              >
                <Plus size={17} /> Add to my picks
              </button>
              <small>
                Illustrative category photo. Build a meal plan; no order will be
                placed.
              </small>
            </div>
          </>
        ) : (
          <div className="dish-dialog-copy">
            <span className="menu-kicker">A MEAL IN THE MAKING</span>
            <h2>Your picks</h2>
            {count ? (
              <>
                {previewMenu.products
                  .filter((p) => basket[p.id])
                  .map((p) => (
                    <div className="basket-row" key={p.id}>
                      <DishPhoto product={p} />
                      <div>
                        <strong>{p.names.en}</strong>
                        <span>{money(p.price_bani * basket[p.id])}</span>
                      </div>
                      <div className="basket-quantity">
                        <button
                          aria-label={`Remove one ${p.names.en}`}
                          onClick={() => update(p, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{basket[p.id]}</span>
                        <button
                          aria-label={`Add one ${p.names.en}`}
                          disabled={basket[p.id] >= 20}
                          onClick={() => update(p, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                <div className="basket-total">
                  <span>Menu total</span>
                  <strong>{money(total)}</strong>
                </div>
                <p>
                  Your selections are a meal plan for this visit. They have not
                  been sent to a kitchen, and no payment is due.
                </p>
                <button className="primary wide" onClick={close}>
                  Keep exploring
                </button>
              </>
            ) : (
              <div className="menu-empty">
                <ShoppingBag size={34} />
                <p>
                  Your next favourite is waiting. Pick a dish to start planning
                  your meal.
                </p>
                <button className="primary" onClick={close}>
                  Explore the menu
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
