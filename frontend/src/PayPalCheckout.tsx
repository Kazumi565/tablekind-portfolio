import { useEffect, useRef, useState } from "react";
import { bani } from "./api";
import { useMoney } from "./Currency";
import type { State } from "./types";

type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
type Checkout = {
  paymentId: string;
  approvalUrl: string;
  phase: string;
  status: string;
  message: string;
  amountMinor: number;
  tipMinor: number;
  currency: string;
  cancelRequested: boolean;
};

export function PayPalCheckout({
  state,
  action,
  busy,
}: {
  state: State;
  action: Mutation;
  busy: boolean;
}) {
  const { money, currency } = useMoney();
  const [tip, setTip] = useState("0");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [starting, setStarting] = useState(false);
  const actorId = state.actor.id;
  const own = state.bill.guests.find((g) => g.id === actorId);
  const payment = state.payments.find(
    (p) =>
      p.payer_id === actorId && p.method === "PAYPAL" && p.status === "PENDING",
  );
  const id = payment?.id;
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    setCheckout(null);
    setError("");
    if (!id) return;
    let active = true;
    const read = async () => {
      try {
        const result = await actionRef.current(
          `/paypal/${id}`,
          undefined,
          "GET",
        );
        if (active && result) {
          setCheckout(result);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Status is temporarily unavailable. Your share remains protected; retry shortly.",
          );
      }
    };
    void read();
    const timer = setInterval(() => void read(), 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, actorId]);
  const change = async (path: string, body: unknown = {}) => {
    setStarting(true);
    setError("");
    try {
      const result = await action(path, body);
      if (result?.phase) setCheckout(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };
  if (state.actor.kind !== "GUEST")
    return (
      <section className="card checkout">
        <h2>PayPal sandbox</h2>
        <p>
          Each diner approves and pays their own share from their guest view.
        </p>
      </section>
    );
  return (
    <section
      className="card checkout paypal-checkout"
      id="checkout"
      aria-label="PayPal sandbox checkout"
    >
      <span className="eyebrow">Step 3 · Pay your share</span>
      <h2>PayPal sandbox</h2>
      <p>No real money is charged. Use a PayPal sandbox buyer account.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {payment ? (
        <>
          <p>
            <strong>{money(payment.amount_bani + payment.tip_bani)}</strong>{" "}
            reserved for this checkout.
          </p>
          <p role="status">{checkout?.message ?? "Preparing your checkout…"}</p>
          {checkout?.phase === "APPROVAL" && (
            <div className="checkout-actions">
              <a className="button primary wide" href={checkout.approvalUrl}>
                Continue to PayPal
              </a>
              <p>
                After approving on PayPal, return here to finish. Approval alone
                does not settle your bill.
              </p>
              <button
                className="wide"
                disabled={busy || starting}
                onClick={() => void change(`/paypal/${payment.id}/approve`)}
              >
                Finish approved payment
              </button>
            </div>
          )}
          {checkout?.phase === "REVIEW" && (
            <p className="notice">
              Ask the demo operator to review this attempt. Do not pay the same
              share again.
            </p>
          )}
          {!checkout?.cancelRequested && checkout?.status === "PENDING" && (
            <button
              disabled={busy || starting}
              onClick={() => void change(`/paypal/${payment.id}/cancel`)}
            >
              Cancel this checkout
            </button>
          )}
          <small>
            Reference: {payment.id.slice(0, 8)} · Reloading this page keeps the
            same attempt.
          </small>
        </>
      ) : !own?.remaining_bani ? (
        <p className="success" role="status">
          Your share is settled. Thank you!
        </p>
      ) : (
        <>
          <p>
            Available to pay: <strong>{money(own.available_bani)}</strong>
          </p>
          {own.available_bani < own.remaining_bani && (
            <p className="notice">
              Some portions are reserved by another checkout.
            </p>
          )}
          {state.proposals.some((p) => p.status === "PENDING") && (
            <p className="notice">
              Resolve pending sharing proposals before paying the affected
              items.
            </p>
          )}
          <label className="field">
            <span>Optional tip in {currency}</span>
            <input
              inputMode="decimal"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
            />
          </label>
          <button
            className="primary wide"
            disabled={
              busy ||
              starting ||
              !state.paypalEnabled ||
              own.available_bani <= 0 ||
              state.session.status !== "OPEN"
            }
            onClick={() => {
              try {
                const tipMinor = bani(tip || "0");
                if (tipMinor < 0) throw new Error("Tip must be non-negative.");
                void change("/paypal", { tipMinor });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Reserve my share for PayPal
          </button>
          {!state.paypalEnabled && (
            <p className="notice">
              The demo operator must configure PayPal sandbox access for this
              restaurant.
            </p>
          )}
        </>
      )}
    </section>
  );
}
