import { useState } from "react";
import { useMoney } from "./Currency";
import type { State } from "./types";

type Share = { guestId: string; name: string; amountMinor: number };
type Preview = {
  status: "READY" | "CLARIFY";
  question?: string;
  draftId?: string;
  revision?: number;
  summary?: string;
  currency?: string;
  requiredGuestIds?: string[];
  items?: {
    itemId: string;
    name: string;
    totalMinor: number;
    shares: Share[];
  }[];
  totals?: Share[];
};
export function SplitAssistant({
  state,
  action,
  busy,
}: {
  state: State;
  action: (path: string, body?: unknown, method?: string) => Promise<any>;
  busy: boolean;
}) {
  const { money } = useMoney();
  const [instruction, setInstruction] = useState(
    "Mihai pays for the burger, Diego pays for the pasta, and everyone shares the starter equally.",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const stale =
    preview?.status === "READY" && preview.revision !== state.session.revision;
  const guests = state.guests.filter((g) => g.active);
  const items = state.items.filter((i) =>
    ["ACCEPTED", "PREPARING", "READY", "SERVED"].includes(i.status),
  );
  async function interpret() {
    setWorking(true);
    setError("");
    setPreview(null);
    setSent(false);
    try {
      setPreview(await action("/ai-splits/preview", { instruction }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function confirm() {
    if (!preview?.draftId || stale) return;
    setWorking(true);
    setError("");
    try {
      const result = await action(`/ai-splits/${preview.draftId}/confirm`, {
        revision: preview.revision,
      });
      if (result?.proposalId) {
        setSent(true);
        setPreview(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="card split-assistant" aria-label="AI split assistant">
      <span className="eyebrow">Step 1 · Describe the split</span>
      <h2>Split it in your own words</h2>
      <p>
        Describe who covers each dish. Review the exact amounts before asking
        affected diners to agree.
      </p>
      <details>
        <summary>Names and dish references</summary>
        <p>{guests.map((g, n) => `G${n + 1}: ${g.nickname}`).join(" · ")}</p>
        <ul>
          {items.map((i, n) => (
            <li key={i.id}>
              I{n + 1}: {i.snapshot.names.en} × {i.quantity}
            </li>
          ))}
        </ul>
        <p>
          Use a reference when names repeat. Unmentioned dishes keep their
          current split.
        </p>
      </details>
      <label className="field">
        <span>Your split instructions</span>
        <textarea
          value={instruction}
          maxLength={2000}
          rows={3}
          onChange={(e) => {
            setInstruction(e.target.value);
            setPreview(null);
            setSent(false);
          }}
        />
      </label>
      <button
        className="primary"
        disabled={
          busy ||
          working ||
          !instruction.trim() ||
          !items.length ||
          state.session.status !== "OPEN"
        }
        onClick={() => void interpret()}
      >
        {working ? "Working…" : "Preview split with AI"}
      </button>
      <small>
        Uses a hosted AI service when enabled by the operator. Amounts are
        calculated by TableKind.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="success" role="status">
          Proposal created. Check “Agreement needed” below for diner votes.
        </p>
      )}
      {preview?.status === "CLARIFY" && (
        <div className="notice" role="status">
          <strong>Clarify your request</strong>
          <p>{preview.question}</p>
        </div>
      )}
      {preview?.status === "READY" && (
        <div className="split-preview">
          <span className="eyebrow">Step 2 · Review and request consent</span>
          <h3>Proposed split</h3>
          <p>{preview.summary}</p>
          {preview.items?.map((item) => (
            <article key={item.itemId}>
              <div className="spread">
                <strong>{item.name}</strong>
                <strong>{money(item.totalMinor, preview.currency)}</strong>
              </div>
              {item.shares.map((s) => (
                <div className="summary-row" key={s.guestId}>
                  <span>{s.name}</span>
                  <span>{money(s.amountMinor, preview.currency)}</span>
                </div>
              ))}
            </article>
          ))}
          <h3>Resulting diner totals</h3>
          {preview.totals?.map((s) => (
            <div className="summary-row" key={s.guestId}>
              <span>{s.name}</span>
              <strong>{money(s.amountMinor, preview.currency)}</strong>
            </div>
          ))}
          <p>
            Consent required from{" "}
            {preview.requiredGuestIds
              ?.map(
                (id) => guests.find((g) => g.id === id)?.nickname ?? "Diner",
              )
              .join(", ")}
            . Your confirmation records your own consent.
          </p>
          <p>
            The current bill changes only when everyone affected agrees. No
            payment is taken by this step.
          </p>
          {stale && (
            <p className="notice" role="alert">
              The table changed. Request and review a fresh preview.
            </p>
          )}
          <button
            className="primary"
            disabled={busy || working || stale}
            onClick={() => void confirm()}
          >
            Confirm preview and propose
          </button>
        </div>
      )}
    </section>
  );
}
