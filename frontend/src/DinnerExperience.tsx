import { Check, LockKeyhole, Receipt, UtensilsCrossed } from "lucide-react";
import { DishPhoto } from "./MenuGallery";
import { useMoney } from "./Currency";
import type { Item, Menu, State } from "./types";
import "./dinnerExperience.css";

export function DinnerJourney({
  state,
  previewReady,
}: {
  state: State;
  previewReady: boolean;
}) {
  const pending = state.proposals.some((p) => p.status === "PENDING");
  const ordered = state.items.some((i) =>
    ["ACCEPTED", "PREPARING", "READY", "SERVED"].includes(i.status),
  );
  const settled = ordered && state.bill.remainingBani === 0;
  const agreed = state.proposals.some((p) => p.status === "ACCEPTED");
  const paying = state.payments.some((p) => p.status === "PENDING") || agreed;
  const current = !ordered
    ? 0
    : pending
      ? 2
      : previewReady
        ? 1
        : paying || settled
          ? 3
          : 1;
  const completed = [ordered, pending || agreed, agreed && !pending, settled];
  return (
    <ol className="dinner-journey" aria-label="Dinner journey">
      {["Order", "Review split", "Agree", "Pay"].map((name, index) => (
        <li
          key={name}
          className={`${index === current ? "current" : ""} ${completed[index] ? "complete" : ""}`}
          aria-current={!settled && index === current ? "step" : undefined}
        >
          <span>
            {completed[index] ? (
              <Check size={14} aria-label="Completed" />
            ) : (
              index + 1
            )}
          </span>
          {name}
        </li>
      ))}
    </ol>
  );
}

export function DinnerShare({ state }: { state: State }) {
  const { money } = useMoney();
  const own = state.bill.guests.find((g) => g.id === state.actor.id);
  return (
    <section className="card dinner-share" aria-label="Your current share">
      <div className="dinner-share-person">
        <span className="avatar">{own?.nickname[0] ?? "?"}</span>
        <div>
          <strong>{own?.nickname ?? "Your share"}</strong>
          <span>At this table · you</span>
        </div>
        <Receipt size={21} />
      </div>
      <span className="dinner-share-label">My unpaid share</span>
      <h2>{money(own?.remaining_bani ?? 0)}</h2>
      <p>
        {money(own?.paid_bani ?? 0)} paid
        {own?.reserved_bani
          ? ` · ${money(own.reserved_bani)} awaiting confirmation`
          : ""}
      </p>
      <a className="button primary wide" href="#checkout">
        {own?.remaining_bani ? "Pay my share" : "View payment details"}
      </a>
      <small>
        <LockKeyhole size={13} />
        Your current balance stays in place until everyone affected agrees.
      </small>
    </section>
  );
}

export function DinnerBalances({ state }: { state: State }) {
  const { money } = useMoney();
  return (
    <section
      className="card dinner-balances"
      aria-label="Everyone's current shares"
    >
      <div className="spread">
        <h3>At your table</h3>
        <span>Unpaid shares</span>
      </div>
      {state.bill.guests.map((g) => (
        <div
          className={`balance ${g.id === state.actor.id ? "is-you" : ""}`}
          key={g.id}
        >
          <span>
            <span className="avatar">{g.nickname[0]}</span>
            <span>
              {g.nickname}
              {g.id === state.actor.id && <small>You</small>}
            </span>
          </span>
          <span>
            <strong>{money(g.remaining_bani)}</strong>
            {g.reserved_bani > 0 && (
              <small>{money(g.reserved_bani)} reserved</small>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

export function ReceiptPhoto({ item, menu }: { item: Item; menu: Menu }) {
  const product = menu.products.find(
    (p) => p.names.en === item.snapshot.names.en,
  );
  return product ? (
    <DishPhoto product={product} className="receipt-photo" />
  ) : (
    <div className="receipt-photo dish-photo-fallback">
      <UtensilsCrossed size={23} aria-hidden="true" />
    </div>
  );
}
