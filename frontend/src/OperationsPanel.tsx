import { useEffect, useState } from "react";
import { request } from "./api";

type Status = {
  observedAt: string;
  status: string;
  counts: Record<string, number>;
  worker: { status: string; secondsSinceSuccess: number };
  posConfigured: boolean;
  alerts: { code: string; severity: string; message: string }[];
};

export function OperationsPanel({
  rid,
  token,
}: {
  rid: string;
  token: string;
}) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    async function load() {
      try {
        const value = await request<Status>(
          `/restaurants/${rid}/operations`,
          token,
        );
        if (active) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active) {
          setData(null);
          setError((e as Error).message);
        }
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [rid, token, refresh]);
  return (
    <section className="card">
      <h2>System status</h2>
      <p>
        Restaurant-scoped checks. Refreshes every 30 seconds while this screen
        is open.
      </p>
      <button onClick={() => setRefresh((n) => n + 1)}>
        Refresh system status
      </button>
      {error && (
        <p role="alert">
          Status unavailable. Last results are not being shown as current.{" "}
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Checking status…</p>}
      {data && (
        <>
          <h3>
            {data.status === "OK"
              ? "No active operational alerts"
              : "Needs attention"}
          </h3>
          <p>
            Checked {new Date(data.observedAt).toLocaleTimeString()}. POS
            worker: {data.worker.status.toLowerCase()}.
          </p>
          {!data.posConfigured && (
            <p>No POS is connected to this restaurant.</p>
          )}
          {data.alerts.map((a) => (
            <article className="notice" key={a.code}>
              <strong>
                {a.severity === "critical" ? "Action needed" : "Review"}
              </strong>
              <p>{a.message}</p>
            </article>
          ))}
          <dl>
            <dt>Undelivered POS messages</dt>
            <dd>{data.counts.queuedPos}</dd>
            <dt>Failed POS messages</dt>
            <dd>{data.counts.failedPos}</dd>
            <dt>Oldest undelivered message (seconds)</dt>
            <dd>{data.counts.oldestPosSeconds}</dd>
            <dt>Pending payments</dt>
            <dd>{data.counts.pendingPayments}</dd>
            <dt>Payments pending over ten minutes</dt>
            <dd>{data.counts.oldPayments}</dd>
            <dt>Refunds pending over ten minutes</dt>
            <dd>{data.counts.oldRefunds}</dd>
            <dt>Saved POS comparisons with differences</dt>
            <dd>{data.counts.posDifferences}</dd>
          </dl>
        </>
      )}
      <p className="notice">
        TEST providers only. These checks do not certify real payments, kitchen
        delivery or recent backups. During an interruption, keep uncertain
        payments reserved and use the restaurant's established staff/POS
        fallback without double-collecting.
      </p>
    </section>
  );
}
