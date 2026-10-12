import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useMoney } from "./Currency";
import type { State } from "./types";
import "./dinnerPanels.css";

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
  onPreviewChange,
}: {
  state: State;
  action: (path: string, body?: unknown, method?: string) => Promise<any>;
  busy: boolean;
  onPreviewChange?: (ready: boolean) => void;
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
  const previewReady = preview?.status === "READY" && !stale && !error && !sent;
  useEffect(() => {
    onPreviewChange?.(previewReady);
  }, [onPreviewChange, previewReady]);
  useEffect(() => () => onPreviewChange?.(false), [onPreviewChange]);
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
    <section
      className="card split-assistant dinner-split-panel"
      aria-label="AI split assistant"
    >
      <div className="dinner-panel-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} aria-hidden="true" /> Make sharing simple
          </span>
          <h2>Split it in your own words</h2>
        </div>
        <span className="dinner-panel-status">
          {previewReady ? "Ready to review" : "Review before sharing"}
        </span>
      </div>
      <p className="dinner-panel-intro">
        Tell us who covers each dish. Review the amounts, then ask everyone
        affected to agree.
      </p>
      <label className="field">
        <span>Your split instructions</span>
        <textarea
          value={instruction}
          maxLength={2000}
          rows={3}
          disabled={working}
          onChange={(e) => {
            setInstruction(e.target.value);
            setPreview(null);
            setSent(false);
            setError("");
          }}
        />
      </label>
      <details className="dinner-split-references">
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
          Use references when names repeat. Unmentioned dishes keep their
          current split.
        </p>
      </details>
      <div className="dinner-preview-action">
        <small>
          TableKind calculates every cent. AI interprets your request when
          enabled.
        </small>
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
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="success" role="status">
          Proposal created. Check “Agreement needed” for diner votes.
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
          <div className="dinner-preview-heading">
            <h3>Proposed split</h3>
            <span className="dinner-panel-status">
              {stale ? "Needs a fresh preview" : "Bill unchanged"}
            </span>
          </div>
          <p>{preview.summary}</p>
          {preview.items?.map((item) => (
            <article className="dinner-split-item" key={item.itemId}>
              <div className="spread">
                <strong>{item.name}</strong>
                <strong>{money(item.totalMinor, preview.currency)}</strong>
              </div>
              <div className="dinner-split-shares">
                {item.shares.map((s) => (
                  <div key={s.guestId}>
                    <span>{s.name}</span>
                    <strong>{money(s.amountMinor, preview.currency)}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
          <h3>Resulting diner totals</h3>
          <p className="dinner-balance-explanation">
            Remaining balances after payments already received. Pending payments
            are included.
          </p>
          <div className="dinner-proposed-balances">
            {preview.totals?.map((s) => {
              const current = state.bill.guests.find((g) => g.id === s.guestId);
              return (
                <div className="dinner-diner-balance" key={s.guestId}>
                  <strong>
                    {s.name}
                    {s.guestId === state.actor.id && <span> · you</span>}
                  </strong>
                  <dl>
                    <div>
                      <dt>Current</dt>
                      <dd>
                        {current
                          ? money(current.remaining_bani, preview.currency)
                          : "—"}
                      </dd>
                    </div>
                    <ArrowRight size={14} aria-hidden="true" />
                    <div>
                      <dt>Proposed</dt>
                      <dd>
                        {money(
                          s.amountMinor - (current?.paid_bani ?? 0),
                          preview.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                  {!!current?.paid_bani && (
                    <small>
                      {money(current.paid_bani, preview.currency)} paid ·{" "}
                      {money(s.amountMinor, preview.currency)} total share
                    </small>
                  )}
                  {!!current?.reserved_bani && (
                    <small>
                      {money(current.reserved_bani, preview.currency)} payment
                      pending
                    </small>
                  )}
                </div>
              );
            })}
          </div>
          {stale && (
            <p className="notice" role="alert">
              The table changed. Request and review a fresh preview.
            </p>
          )}
          <div className="dinner-confirm-action">
            <div>
              <p>
                Agreement needed from{" "}
                {preview.requiredGuestIds
                  ?.map(
                    (id) =>
                      guests.find((g) => g.id === id)?.nickname ?? "Diner",
                  )
                  .join(", ") || "the affected diners"}
                . Your confirmation records your own consent.
              </p>
              <small>
                <Check size={14} aria-hidden="true" /> The bill changes when
                everyone affected agrees. This step takes no payment.
              </small>
            </div>
            <button
              className="primary"
              disabled={busy || working || stale}
              onClick={() => void confirm()}
            >
              Confirm preview and propose
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
