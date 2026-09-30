import { useEffect, useState, type ReactNode } from "react";
import { bani, money } from "./api";
import type { Payment, Refund, State } from "./types";

type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PaymentsPanel({
  state,
  action,
  busy,
}: {
  state: State;
  action: Mutation;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [refund, setRefund] = useState<Payment | null>(null);
  const [showAll, setShowAll] = useState(false);
  const staff = state.actor.kind === "STAFF",
    manager = state.actor.role === "MANAGER" || state.actor.role === "OWNER";
  useEffect(() => {
    setReport(null);
    setConfirmation(null);
  }, [state.session.revision]);
  const run: Mutation = async (path, body, method) => {
    setError("");
    try {
      if (method !== "GET" && state.paymentsEnabled === false)
        throw new Error(
          "Payment changes are unavailable in this installation.",
        );
      return await action(path, body, method);
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  };
  return (
    <section className="payment-panel">
      <h2>Payments</h2>
      {state.paymentsEnabled === false && (
        <p className="notice">
          Payment changes are unavailable. Existing payment history can still be
          reviewed.
        </p>
      )}
      {!staff && (
        <details>
          <summary>Other guests' payments</summary>
          <label className="check">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show the whole table
          </label>
        </details>
      )}
      {state.testPayments && (
        <p className="notice" role="note">
          TEST MODE — no bank, MIA or terminal connection. Use pretend cash
          only.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {state.payments.length === 0 && (
        <p className="muted">No payments requested yet.</p>
      )}
      <div className="payment-list">
        {state.payments
          .filter(
            (p) =>
              staff ||
              showAll ||
              p.payer_id === state.actor.id ||
              p.parts.some((part) => part.guest_id === state.actor.id),
          )
          .map((p) => (
            <article className="card" key={p.id} data-payment-id={p.id}>
              <div className="spread">
                <h3>
                  {state.guests.find((g) => g.id === p.payer_id)?.nickname} ·{" "}
                  {p.method}
                </h3>
                <span className="pill">{p.status.toLowerCase()}</span>
              </div>
              <p>
                <strong>{money(p.amount_bani)}</strong> bill +{" "}
                {money(p.tip_bani)} tip ={" "}
                <strong>{money(p.amount_bani + p.tip_bani)}</strong>
              </p>
              <small>
                {p.is_test ? "TEST · " : ""}
                {new Date(p.created_at).toLocaleString()} · {p.id.slice(0, 8)}
              </small>
              <details>
                <summary>Whose items this covers</summary>
                {p.parts.map((part) => (
                  <p key={part.item_id + part.guest_id}>
                    {state.guests.find((g) => g.id === part.guest_id)?.nickname}
                    :{" "}
                    {
                      state.items.find((i) => i.id === part.item_id)?.snapshot
                        .names.en
                    }{" "}
                    — {money(part.amount_bani)}
                  </p>
                ))}
              </details>
              {p.status === "PENDING" && (
                <>
                  <p className="muted">
                    Not paid yet. These shares remain reserved until the outcome
                    is confirmed.
                  </p>
                  {["CARD", "MIA"].includes(p.method) ? (
                    <>
                      {(staff || p.payer_id === state.actor.id) && (
                        <>
                          {p.is_test && (
                            <TestCheckout
                              id={p.id}
                              kind="PAYMENT"
                              action={run}
                              busy={busy}
                            />
                          )}
                          <div className="row wrap">
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(`/payments/${p.id}/reconcile`)
                              }
                            >
                              Check provider status
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(`/payments/${p.id}/cancel`)
                              }
                            >
                              Cancel checkout
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : staff ? (
                    <>
                      <Collection p={p} action={run} busy={busy} />
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Cancel only if no money was collected and the terminal is not processing this payment. Confirm cancellation?",
                            )
                          )
                            void run(`/payments/${p.id}/cancel`);
                        }}
                      >
                        Cancel uncollected request
                      </button>
                    </>
                  ) : (
                    <p>
                      Wait for the waiter to collect and confirm your{" "}
                      {p.method === "CASH" ? "cash" : "terminal payment"}. Ask
                      them if you need to cancel.
                    </p>
                  )}
                </>
              )}
              {p.status === "SUCCEEDED" && (
                <>
                  {p.method === "CASH" && (
                    <p>
                      Cash received: {money(p.received_bani ?? 0)} · Change
                      returned: {money(p.change_bani ?? 0)}
                    </p>
                  )}
                  <div className="row wrap">
                    {(staff || p.payer_id === state.actor.id) && (
                      <button
                        disabled={busy}
                        onClick={async () =>
                          setConfirmation(
                            await run(
                              `/payments/${p.id}/confirmation`,
                              undefined,
                              "GET",
                            ),
                          )
                        }
                      >
                        View confirmation
                      </button>
                    )}
                    {manager && (
                      <button disabled={busy} onClick={() => setRefund(p)}>
                        Request refund
                      </button>
                    )}
                  </div>
                </>
              )}
              {p.refunds.map((r) => (
                <div className="request" key={r.id}>
                  <strong>
                    Refund: {money(r.amount_bani)} bill + {money(r.tip_bani)}{" "}
                    tip · {r.status.toLowerCase()}
                  </strong>
                  <p>
                    {r.reason} ·{" "}
                    {r.mode === "REDUCE_BILL"
                      ? "Reduces the bill"
                      : "Returns payment; bill still due"}
                  </p>
                  {manager && r.status === "PENDING" && (
                    <>
                      {["CARD", "MIA"].includes(p.method) ? (
                        <>
                          {p.is_test && (
                            <TestCheckout
                              id={r.id}
                              kind="REFUND"
                              action={run}
                              busy={busy}
                            />
                          )}
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(`/payments/${p.id}/reconcile`)
                            }
                          >
                            Check refund status
                          </button>
                        </>
                      ) : (
                        <RefundCollection
                          refund={r}
                          terminal={p.method === "TERMINAL"}
                          action={run}
                          busy={busy}
                        />
                      )}
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Cancel only if no refund was paid out. Online refunds will be checked with the provider.",
                            )
                          )
                            void run(`/refunds/${r.id}/cancel`);
                        }}
                      >
                        Cancel refund request
                      </button>
                    </>
                  )}
                </div>
              ))}
            </article>
          ))}
      </div>
      {manager && (
        <div className="card">
          <h3>Reconciliation</h3>
          <p>
            Compare confirmed payments and refunds with the internal bill
            ledger. Tips stay separate.
          </p>
          <button
            disabled={busy}
            onClick={async () =>
              setReport(await run("/payments/reconciliation", undefined, "GET"))
            }
          >
            Refresh reconciliation
          </button>
          {report && (
            <>
              <p role="status">
                <strong>
                  {report.balanced ? "Ledger matches" : "Needs investigation"}
                </strong>
              </p>
              <p>
                Net bill payments: {money(report.expectedNetBani)} · Ledger:{" "}
                {money(report.linkedLedgerBani)}
              </p>
              <p>
                Net tips: {money(report.netTipsBani)} · Unlinked entries:{" "}
                {money(report.unlinkedLedgerBani)}
              </p>
              <div className="payment-report">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Net bill</th>
                      <th>Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.method}</td>
                        <td>{p.status}</td>
                        <td>{money(p.expected_net_bani)}</td>
                        <td>{money(p.ledger_bani)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small>{report.notice}</small>
            </>
          )}
        </div>
      )}
      {confirmation && (
        <div
          className="card payment-confirmation"
          role="region"
          aria-label="Payment confirmation"
        >
          <div className="spread">
            <h3>{confirmation.title}</h3>
            <button onClick={() => setConfirmation(null)}>
              Close confirmation
            </button>
          </div>
          <p>{confirmation.restaurant.name}</p>
          <p>{confirmation.payment.id}</p>
          <p>
            {money(confirmation.payment.amount_bani)} bill +{" "}
            {money(confirmation.payment.tip_bani)} tip ·{" "}
            {confirmation.payment.method}
          </p>
          {confirmation.parts.map((p: any) => (
            <p key={p.item_id + p.guest_id}>
              {p.nickname}: {p.snapshot.names.en} — {money(p.amount_bani)}
            </p>
          ))}
          {confirmation.refunds.map((r: any) => (
            <p key={r.id}>
              Refund {r.status.toLowerCase()}:{" "}
              {money(r.amount_bani + r.tip_bani)}
            </p>
          ))}
          <p>{confirmation.notice}</p>
          <button
            onClick={() => {
              const content = [
                confirmation.title,
                confirmation.restaurant.name,
                confirmation.payment.id,
                `Bill: ${money(confirmation.payment.amount_bani)}; tip: ${money(confirmation.payment.tip_bani)}; ${confirmation.payment.method}`,
                ...confirmation.parts.map(
                  (p: any) =>
                    `${p.nickname}: ${p.snapshot.names.en} — ${money(p.amount_bani)}`,
                ),
                ...confirmation.refunds.map(
                  (r: any) =>
                    `Refund ${r.status}: ${money(r.amount_bani + r.tip_bani)}`,
                ),
                confirmation.notice,
              ].join("\n");
              const url = URL.createObjectURL(
                new Blob([content], { type: "text/plain;charset=utf-8" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `payment-${confirmation.payment.id}.txt`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download confirmation
          </button>
        </div>
      )}
      {refund && (
        <RefundForm
          p={state.payments.find((p) => p.id === refund.id) ?? refund}
          closed={state.session.status === "CLOSED"}
          action={run}
          busy={busy}
          onClose={() => setRefund(null)}
        />
      )}
    </section>
  );
}
function TestCheckout({
  id,
  kind,
  action,
  busy,
}: {
  id: string;
  kind: "PAYMENT" | "REFUND";
  action: Mutation;
  busy: boolean;
}) {
  const [outcome, setOutcome] = useState("SUCCEEDED"),
    [deliver, setDeliver] = useState(true);
  return (
    <details className="test-checkout">
      <summary>Open TEST {kind === "REFUND" ? "refund" : "checkout"}</summary>
      <p>
        Local provider simulator. No card details, bank account or real charge.
      </p>
      <Field label="Test outcome">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="SUCCEEDED">Success</option>
          <option value="FAILED">Failure</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired at provider</option>
        </select>
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={deliver}
          onChange={(e) => setDeliver(e.target.checked)}
        />
        Deliver signed notification immediately
      </label>
      <p className="muted">
        Uncheck to simulate a lost notification, then check provider status. The
        share stays reserved in the meantime.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void action(`/payments/${id}/test-result`, { kind, outcome, deliver })
        }
      >
        Simulate {kind === "REFUND" ? "refund" : "payment"} outcome
      </button>
    </details>
  );
}
function Collection({
  p,
  action,
  busy,
}: {
  p: Payment;
  action: Mutation;
  busy: boolean;
}) {
  const [received, setReceived] = useState(
      ((p.amount_bani + p.tip_bani) / 100).toFixed(2),
    ),
    [reference, setReference] = useState(""),
    [collected, setCollected] = useState(false),
    [error, setError] = useState("");
  const cash = p.method === "CASH";
  let change: number | null = null;
  try {
    change = bani(received) - p.amount_bani - p.tip_bani;
  } catch {}
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await action(`/payments/${p.id}/confirm`, {
            receivedBani: cash ? bani(received) : null,
            reference,
            collected,
          });
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      {cash ? (
        <>
          <Field label="Cash received in MDL">
            <input
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              required
            />
          </Field>
          <p>
            Change to return:{" "}
            {change !== null && change >= 0
              ? money(change)
              : "Insufficient or invalid amount"}
            . The agreed tip is already included.
          </p>
        </>
      ) : (
        <Field label="Terminal transaction reference">
          <input
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        </Field>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={collected}
          onChange={(e) => setCollected(e.target.checked)}
          required
        />
        {cash
          ? "I received the cash and returned the change"
          : "The physical terminal confirmed this payment"}
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || !collected}>
        Confirm {cash ? "cash received" : "terminal payment"}
      </button>
    </form>
  );
}
function RefundCollection({
  refund,
  terminal,
  action,
  busy,
}: {
  refund: Refund;
  terminal: boolean;
  action: Mutation;
  busy: boolean;
}) {
  const [reference, setReference] = useState(""),
    [returned, setReturned] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action(`/refunds/${refund.id}/confirm`, { reference, returned });
      }}
    >
      {terminal && (
        <Field label="Terminal refund reference">
          <input
            required
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
      )}
      <label className="check">
        <input
          type="checkbox"
          required
          checked={returned}
          onChange={(e) => setReturned(e.target.checked)}
        />
        I returned {money(refund.amount_bani + refund.tip_bani)} to the customer
      </label>
      <button className="primary" disabled={busy || !returned}>
        Confirm refund returned
      </button>
    </form>
  );
}
function RefundForm({
  p,
  closed,
  action,
  busy,
  onClose,
}: {
  p: Payment;
  closed: boolean;
  action: Mutation;
  busy: boolean;
  onClose: () => void;
}) {
  const used = p.refunds.filter((r) =>
    ["PENDING", "SUCCEEDED"].includes(r.status),
  );
  const available = p.amount_bani - used.reduce((n, r) => n + r.amount_bani, 0),
    tipAvailable = p.tip_bani - used.reduce((n, r) => n + r.tip_bani, 0);
  const [amount, setAmount] = useState((available / 100).toFixed(2)),
    [tip, setTip] = useState("0"),
    [mode, setMode] = useState("REDUCE_BILL"),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <section
      className="card refund-form"
      role="region"
      aria-label="Request refund"
    >
      <div className="spread">
        <h3>Manager refund request</h3>
        <button onClick={onClose}>Close refund form</button>
      </div>
      <p>
        Available: {money(available)} bill and {money(tipAvailable)} tip.
        Pending refunds are already excluded.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const r = await action(`/payments/${p.id}/refunds`, {
              amountBani: bani(amount),
              tipBani: bani(tip),
              mode,
              reason,
            });
            if (r) onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Bill refund in MDL">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
        <Field label="Tip refund in MDL">
          <input
            inputMode="decimal"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            required
          />
        </Field>
        <Field label="What happens to the bill">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="REDUCE_BILL">
              Reduce the charge — customer no longer owes it
            </option>
            <option value="RETURN_PAYMENT" disabled={closed}>
              Return payment — customer still owes the charge
            </option>
          </select>
        </Field>
        <Field label="Refund reason">
          <input
            required
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p>
          Refunds follow the original item's guest allocation. This request
          alone does not return money.
        </p>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          Create refund request
        </button>
      </form>
    </section>
  );
}
