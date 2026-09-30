import { useCallback, useEffect, useState } from "react";
import { bani, money, request } from "./api";
import { managesRestaurant } from "./interfaces";
import type { Dashboard } from "./types";

type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
type Report = {
  status: string;
  checkedRevision: number;
  posRevision: number;
  differences: string[];
  localTotalBani: number;
  posTotalBani: number;
  localPaidBani: number;
  posPaidBani: number;
  localTipBani: number;
  posTipBani: number;
};
type PosState = {
  mockAvailable: boolean;
  connection: {
    connector: string;
    paused: boolean;
    catalog_revision: number;
    last_success_at: string | null;
    last_error: string | null;
  } | null;
  simulation: { failure_mode: string; catalog_revision: number } | null;
  counts: { status: string; count: number }[];
  sessions: {
    session_id: string;
    label: string;
    session_status: string;
    delivered_revision: number;
    queued_revision: number;
    reconciliation: Report | null;
    reconciled_at: string | null;
  }[];
  outbox: {
    id: string;
    label: string;
    session_id: string;
    sequence: number;
    revision: number;
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: string;
  }[];
  notice: string;
};

export function PosPanel({
  dash,
  token,
  mutate,
  busy,
}: {
  dash: Dashboard;
  token: string;
  mutate: Mutation;
  busy: boolean;
}) {
  const [data, setData] = useState<PosState | null>(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState("ONLINE");
  const [productId, setProductId] = useState(dash.menu.products[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [itemId, setItemId] = useState("");
  const [items, setItems] = useState<
    { id: string; snapshot: { names: { en: string } }; status: string }[]
  >([]);
  const [kitchen, setKitchen] = useState("PREPARING");
  const [offset, setOffset] = useState("0.00");
  const manager = managesRestaurant(dash.role);
  const prefix = `/restaurants/${dash.restaurant.id}/pos`;
  const load = useCallback(async () => {
    try {
      setData(await request<PosState>(prefix, token));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [prefix, token]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (data && !data.sessions.some((s) => s.session_id === sessionId))
      setSessionId(data.sessions[0]?.session_id ?? "");
  }, [data, sessionId]);
  const queuedRevision = data?.sessions.find(
    (s) => s.session_id === sessionId,
  )?.queued_revision;
  useEffect(() => {
    setReport(null);
    setItemId("");
    setItems([]);
  }, [sessionId]);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void request<{ items: typeof items }>(`/sessions/${sessionId}`, token)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, token, queuedRevision]);
  const sourceProduct = dash.menu.products.find((p) => p.id === productId);
  useEffect(() => {
    if (sourceProduct) {
      setPrice((sourceProduct.price_bani / 100).toFixed(2));
      setAvailable(sourceProduct.available);
    }
  }, [productId, sourceProduct?.price_bani, sourceProduct?.available]);
  async function run(path: string, body: unknown = {}) {
    const result = await mutate(prefix + path, body);
    await load();
    return result;
  }
  const selected = data?.sessions.find((s) => s.session_id === sessionId);
  const shownReport = report ?? selected?.reconciliation;
  const stale =
    shownReport &&
    selected &&
    shownReport.checkedRevision !== selected.queued_revision;
  if (!data)
    return (
      <section className="card">
        <h2>POS integration</h2>
        <p>{error || "Loading integration status…"}</p>
      </section>
    );
  return (
    <section className="pos-panel">
      <div className="spread">
        <div>
          <h2>POS integration</h2>
          <p>Delivery, recovery and comparison with the restaurant system.</p>
        </div>
        <button onClick={() => void load()}>Refresh POS status</button>
      </div>
      <p className="notice">{data.notice}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data.connection ? (
        <div className="card">
          <h3>No POS connected</h3>
          <p>
            Connect the local simulator to test the complete workflow. Close
            existing sessions first. Only sessions opened after connection are
            tracked; old orders are not replayed.
          </p>
          {manager && data.mockAvailable && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void run("/connect-test")}
            >
              Connect TEST POS
            </button>
          )}
          {!data.mockAvailable && (
            <p>
              A real connector needs the chosen POS API and merchant
              configuration.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="spread">
              <h3>TEST POS · {data.connection.paused ? "Paused" : "Active"}</h3>
              {manager && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run("/pause", { paused: !data.connection!.paused })
                  }
                >
                  {data.connection.paused
                    ? "Resume delivery"
                    : "Pause delivery"}
                </button>
              )}
            </div>
            <p>
              Catalog revision {data.connection.catalog_revision}. Last
              acknowledgment:{" "}
              {data.connection.last_success_at
                ? new Date(data.connection.last_success_at).toLocaleString()
                : "none yet"}
              .
            </p>
            <div className="row">
              {data.counts.map((c) => (
                <span className="pill" key={c.status}>
                  {c.status}: {c.count}
                </span>
              ))}
            </div>
            {data.connection.last_error && (
              <p className="error">{data.connection.last_error}</p>
            )}
            <p className="muted">
              Pausing stops new dispatches, but an already-running request may
              finish. Orders remain queued. A local “accepted” status is not POS
              or kitchen confirmation.
            </p>
            {manager && (
              <button
                disabled={busy}
                onClick={() => void run("/catalog/import")}
              >
                Import POS catalog
              </button>
            )}
          </div>
          <div className="card">
            <h3>Bill reconciliation</h3>
            <label className="field">
              <span>POS table session</span>
              <select
                aria-label="POS table session"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">Choose a tracked session</option>
                {data.sessions.map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.label} · {s.session_status} · {s.session_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <p>
                Delivered revision {selected.delivered_revision} / queued
                revision {selected.queued_revision}
              </p>
            )}
            <div className="row">
              <button
                disabled={busy || !sessionId}
                onClick={async () => {
                  const r = await run(`/sessions/${sessionId}/reconcile`);
                  if (r) setReport(r);
                }}
              >
                Compare POS bill
              </button>
              {manager && (
                <button
                  disabled={busy || !sessionId}
                  onClick={() =>
                    void run(`/sessions/${sessionId}/kitchen/import`)
                  }
                >
                  Import kitchen status
                </button>
              )}
            </div>
            {shownReport && (
              <div className="pos-report" data-testid="pos-report">
                <h4>{stale ? "STALE — compare again" : shownReport.status}</h4>
                <p>
                  Comparison only. This does not prove bank settlement or issue
                  a fiscal receipt.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Tablekind</th>
                      <th>TEST POS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Bill</td>
                      <td>{money(shownReport.localTotalBani)}</td>
                      <td>{money(shownReport.posTotalBani)}</td>
                    </tr>
                    <tr>
                      <td>Paid</td>
                      <td>{money(shownReport.localPaidBani)}</td>
                      <td>{money(shownReport.posPaidBani)}</td>
                    </tr>
                    <tr>
                      <td>Net tips</td>
                      <td>{money(shownReport.localTipBani)}</td>
                      <td>{money(shownReport.posTipBani)}</td>
                    </tr>
                  </tbody>
                </table>
                {shownReport.differences.map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </div>
            )}
          </div>
          {manager && data.mockAvailable && (
            <details className="card">
              <summary>TEST POS controls</summary>
              <p>These change the simulator, not a real restaurant system.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("/mock/mode", { mode });
                }}
              >
                <label className="field">
                  <span>Simulator behavior</span>
                  <select
                    aria-label="Simulator behavior"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="LOSE_REPLY">
                      Accept next command, lose its reply
                    </option>
                    <option value="REJECT">Reject new commands</option>
                  </select>
                </label>
                <p>Current behavior: {data.simulation?.failure_mode}</p>
                <button disabled={busy}>Apply simulator behavior</button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    void run(`/mock/products/${productId}`, {
                      priceBani: bani(price),
                      available,
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <h4>Source menu</h4>
                <label className="field">
                  <span>Source product</span>
                  <select
                    aria-label="Source product"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    {dash.menu.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.names.en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Source price in MDL</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                  />{" "}
                  Source available
                </label>
                <button disabled={busy || !productId}>
                  Save TEST source product
                </button>
                <p>
                  Import the POS catalog afterward to update the customer menu.
                </p>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    void run(`/mock/sessions/${sessionId}`, {
                      itemId: itemId || null,
                      status: kitchen,
                      offsetBani: bani(offset),
                    });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <h4>Source bill and kitchen</h4>
                <label className="field">
                  <span>Kitchen item</span>
                  <select
                    aria-label="Kitchen item"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                  >
                    <option value="">Do not change kitchen state</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.snapshot.names.en} · {i.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Kitchen status</span>
                  <select
                    aria-label="Kitchen status"
                    value={kitchen}
                    onChange={(e) => setKitchen(e.target.value)}
                  >
                    <option>PREPARING</option>
                    <option>READY</option>
                    <option>SERVED</option>
                  </select>
                </label>
                <label className="field">
                  <span>TEST bill difference in MDL</span>
                  <input
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <button disabled={busy || !sessionId}>
                  Save TEST bill state
                </button>
                <p>
                  Set a nonzero difference to test mismatch detection. Restore
                  0.00 before comparing again.
                </p>
              </form>
            </details>
          )}
          <div className="card">
            <h3>Delivery queue</h3>
            <p>
              Latest 100 messages. Each table is delivered in order. A failed
              message blocks later messages for that table until reviewed.
            </p>
            {data.outbox.length === 0 && <p>Open a new table to begin.</p>}
            <div className="pos-queue">
              {data.outbox.map((m) => (
                <article key={m.id} data-message-id={m.id}>
                  <div className="spread">
                    <strong>
                      {m.label} · revision {m.revision}
                    </strong>
                    <span className="pill">{m.status}</span>
                  </div>
                  <p>
                    {m.attempts} attempt(s) · message {m.id.slice(0, 8)}
                  </p>
                  {m.last_error && <p>{m.last_error}</p>}
                  {m.status === "RETRY" && (
                    <small>
                      Next attempt: {new Date(m.available_at).toLocaleString()}
                    </small>
                  )}
                  {manager && ["FAILED", "RETRY"].includes(m.status) && (
                    <button
                      disabled={busy}
                      onClick={() => void run(`/messages/${m.id}/retry`)}
                    >
                      Retry same message
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
