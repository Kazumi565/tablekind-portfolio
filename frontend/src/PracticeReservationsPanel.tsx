import { useEffect, useRef, useState, type FormEvent } from "react";
import { request } from "./api";
type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
type Reservation = {
  id: string;
  requested_for: string;
  party_size: number;
  status: string;
  nickname?: string;
  branch_name?: string;
};

/** Simulation only: no capacity is reserved and no notification is sent. */
export function PracticeReservationsPanel({
  token,
  rid,
  sid,
  mutate,
}: {
  token: string;
  rid?: string;
  sid?: string;
  mutate: Mutation;
}) {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = rid
    ? `/restaurants/${rid}/practice-reservations`
    : `/sessions/${sid}/practice-reservations`;
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await request<Reservation[]>(path, token));
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [path, token]);
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (result) {
        setNotice("Practice request updated. No real table was reserved.");
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const when = new Date(String(fields.get("when")));
    if (Number.isNaN(when.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }
    void run(async () => {
      const result = await mutate(path, {
        when: when.toISOString(),
        partySize: Number(fields.get("partySize")),
      });
      if (result) form.reset();
      return result;
    });
  };
  return (
    <section className="card practice-reservations">
      <h2>
        {rid ? "Practice reservation requests" : "Try a reservation request"}
      </h2>
      <p className="notice">
        Simulation only. A request or practice approval does not reserve a
        table, notify a restaurant, or guarantee availability. Do not enter real
        contact details.
      </p>
      {!rid && (
        <form onSubmit={submit}>
          <label className="field">
            Requested date and time (your device time)
            <input type="datetime-local" name="when" required />
          </label>
          <label className="field">
            Number of guests
            <input
              type="number"
              name="partySize"
              defaultValue={2}
              min={1}
              max={20}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Submitting…" : "Send practice request"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Loading practice requests…</p>
      ) : rows.length === 0 ? (
        <p>No practice requests yet.</p>
      ) : (
        <ul className="practice-reservation-list">
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{new Date(r.requested_for).toLocaleString()}</strong>
              <span>
                {r.party_size} guest(s) ·{" "}
                {r.status.replaceAll("_", " ").toLowerCase()}
                {rid ? ` · ${r.branch_name} · ${r.nickname}` : ""}
              </span>
              {rid && r.status === "REQUESTED" && (
                <div className="row wrap">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        mutate(`${path}/${r.id}/decision`, {
                          status: "PRACTICE_APPROVED",
                        }),
                      )
                    }
                  >
                    Practice approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        mutate(`${path}/${r.id}/decision`, {
                          status: "DECLINED",
                        }),
                      )
                    }
                  >
                    Decline
                  </button>
                </div>
              )}
              {!rid &&
                ["REQUESTED", "PRACTICE_APPROVED"].includes(r.status) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() => mutate(`${path}/${r.id}/cancel`))
                    }
                  >
                    Cancel practice request
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
      <button disabled={busy || loading} onClick={() => void load()}>
        Refresh requests
      </button>
    </section>
  );
}
