import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { bani, request } from "./api";
import type { Branch, Dashboard } from "./types";
type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;

export function OnboardingPanel({
  rid,
  token,
  onSection,
  mutate,
}: {
  rid: string;
  token: string;
  onSection: (s: string) => void;
  mutate: Mutation;
}) {
  const [result, setResult] = useState<{
    checks: Record<string, boolean>;
    note: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [message, setMessage] = useState("");
  const load = () =>
    request<typeof result>(`/restaurants/${rid}/onboarding`, token)
      .then(setResult)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [rid, token]);
  const starter = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const priceBani = bani(String(data.get("price") ?? ""));
      if (priceBani < 1) throw new Error("Enter a price greater than zero.");
      const created = await mutate(`/restaurants/${rid}/starter`, {
        branchName: String(data.get("branchName") ?? "").trim(),
        tableLabel: String(data.get("tableLabel") ?? "").trim(),
        categoryName: String(data.get("categoryName") ?? "").trim(),
        productName: String(data.get("productName") ?? "").trim(),
        priceBani,
      });
      if (created) {
        setMessage(
          "First branch, table, item and printable QR code created. Add a waiter next.",
        );
        await load();
      } else
        setError("Setup did not finish. Review the message above and retry.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };
  const steps = [
    ["branch", "1. Branch, hours and service mode", "branches & tables"],
    [
      "pilotTables",
      "2. Enable the tables you want to try",
      "branches & tables",
    ],
    ["printedLinks", "3. Create table QR codes for printing", "QR codes"],
    ["menu", "4. Add a menu with prices and availability", "menu"],
    ["staff", "5. Add a waiter account", "staff"],
    ["testOrder", "6. Join a table and accept a practice order", "practice"],
    [
      "testPayment",
      "7. Complete a TEST payment or pretend cash collection",
      "practice",
    ],
    ["testPos", "8. Connect the TEST POS", "integrations"],
  ];
  return (
    <section className="card">
      <h2>Get your restaurant ready to try</h2>
      <p>
        Work through these in order. Your progress comes from the actual
        restaurant data.
      </p>
      {!result && !error && <p role="status">Loading setup progress…</p>}
      {result && !result.checks.branch && !result.checks.menu && (
        <form className="starter-form" onSubmit={(e) => void starter(e)}>
          <h3>Set up your first table</h3>
          <p>
            Enter one menu item for a practice run. You can edit everything
            afterward.
          </p>
          <div className="grid2">
            <label className="field">
              Branch name
              <input
                name="branchName"
                required
                maxLength={120}
                placeholder="Main location"
              />
            </label>
            <label className="field">
              Table name
              <input
                name="tableLabel"
                required
                maxLength={40}
                placeholder="Table 1"
              />
            </label>
            <label className="field">
              Menu category
              <input
                name="categoryName"
                required
                maxLength={120}
                placeholder="Food"
              />
            </label>
            <label className="field">
              First item
              <input
                name="productName"
                required
                maxLength={120}
                placeholder="House dish"
              />
            </label>
            <label className="field">
              Price in MDL
              <input
                name="price"
                inputMode="decimal"
                required
                placeholder="50.00"
              />
            </label>
          </div>
          <button className="primary" disabled={creating}>
            {creating ? "Creating setup…" : "Create first table and menu"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <ol className="setup-checklist">
        {steps.map(([id, label, section]) => (
          <li key={id}>
            <span>{result?.checks[id] ? "Done" : "To do"}</span>
            <button onClick={() => onSection(section)}>{label}</button>
          </li>
        ))}
      </ol>
      <p className="notice">
        {result?.note ??
          "This checklist is for practice, not approval to process real payments."}
      </p>
      <p>
        Pay-at-table mode means staff enter orders; guests only split and pay.
        Importing a live external POS bill still requires a real connector.
      </p>
      <button onClick={() => void load()}>Refresh checklist</button>
    </section>
  );
}

export function PilotPanel({ rid, token }: { rid: string; token: string }) {
  type Report = {
    counts: Record<string, number>;
    unmatchedScansEstimate: number;
    unmatchedJoinsEstimate: number;
    note: string;
  };
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    request<Report>(`/restaurants/${rid}/pilot?days=30`, token)
      .then(setReport)
      .catch((e) => {
        setReport(null);
        setError((e as Error).message);
      });
  };
  useEffect(() => {
    setReport(null);
    load();
  }, [rid, token]);
  const labels: Record<string, string> = {
    QR_SCAN: "QR / table link views",
    TABLE_JOIN: "Successful joins",
    ORDER_SUBMITTED: "Items submitted",
    SHARE_ACCEPTED: "Share approvals",
    SHARE_REJECTED: "Share rejections",
    PAYMENT_COMPLETED: "TEST payments completed",
    COORDINATION_COMPLETED: "Practice tables fully settled",
    FLOW_ERROR: "API errors in table / restaurant flows",
  };
  return (
    <section className="card pilot-panel" aria-label="Pilot measurements">
      <h2>Practice pilot measurements</h2>
      <p>
        Restaurant totals for the last 30 days (UTC). No IP addresses, names or
        customer profiles are saved in these totals.
      </p>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Loading measurements…</p>}
      {report && (
        <>
          <dl className="pilot-grid">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{report.counts[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <p>
            Unmatched scan views: {report.unmatchedScansEstimate} · Unmatched
            joins before an item: {report.unmatchedJoinsEstimate}
          </p>
          <small>
            {report.note} These figures never verify a real bank or POS payment.
          </small>
        </>
      )}
      <button onClick={load}>Refresh measurements</button>
    </section>
  );
}

export function BranchPolicy({
  branch,
  endpoint,
  mutate,
}: {
  branch: Branch;
  endpoint: string;
  mutate: Mutation;
}) {
  const [mode, setMode] = useState(branch.operating_mode);
  const [languages, setLanguages] = useState(branch.languages);
  const [primary, setPrimary] = useState(branch.default_language);
  const [message, setMessage] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        if (!languages.includes(primary)) {
          setMessage("The default language must be enabled.");
          return;
        }
        const r = await mutate(
          `${endpoint}/branches/${branch.id}/policy`,
          { operatingMode: mode, languages, defaultLanguage: primary },
          "PUT",
        );
        if (r) setMessage("Service settings saved.");
      }}
    >
      <h3>{branch.name} · Guest experience</h3>
      <label className="field">
        Service mode
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="ORDER_AND_PAY">Guests order and pay</option>
          <option value="PAY_AT_TABLE">
            Staff take orders; guests split and pay
          </option>
        </select>
      </label>
      <p>Changing mode does not remove existing orders or payments.</p>
      <fieldset>
        <legend>Menu languages</legend>
        {[
          ["ro", "Română"],
          ["ru", "Русский"],
          ["en", "English"],
        ].map(([code, name]) => (
          <label className="check" key={code}>
            <input
              type="checkbox"
              checked={languages.includes(code)}
              onChange={(e) =>
                setLanguages(
                  e.target.checked
                    ? [...languages, code]
                    : languages.filter((l) => l !== code),
                )
              }
            />
            {name}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Default menu language
        <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
          {["ro", "ru", "en"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <small>
        Menu names and descriptions use these languages. App controls remain in
        English in this version.
      </small>
      <button className="primary">Save service settings</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

export function TableQrPanel({
  dash,
  token,
  mutate,
}: {
  dash: Dashboard;
  token: string;
  mutate: Mutation;
}) {
  const [tid, setTid] = useState(dash.tables[0]?.id ?? "");
  const [link, setLink] = useState<any>(null);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const endpoint = `/restaurants/${dash.restaurant.id}/tables/${tid}/link`;
  useEffect(() => {
    let current = true;
    setLink(null);
    setError("");
    if (tid)
      request(endpoint, token)
        .then((r) => {
          if (current) setLink(r);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [endpoint, token, tid]);
  const url = link?.token
    ? `${location.origin}/?table=${encodeURIComponent(link.token)}`
    : "";
  useEffect(() => {
    let current = true;
    setImage("");
    if (url)
      void QRCode.toDataURL(url, { width: 360, margin: 3 })
        .then((value) => {
          if (current) setImage(value);
        })
        .catch((e) => setError(e.message));
    return () => {
      current = false;
    };
  }, [url]);
  return (
    <section className="card">
      <h2>Printed table QR codes</h2>
      <p>
        Reuse the same printed code for new groups. Staff must open the table
        first. Replacing a code invalidates the old print; it does not sign out
        guests already seated.
      </p>
      <label className="field">
        Table to print
        <select value={tid} onChange={(e) => setTid(e.target.value)}>
          {dash.tables.map((t) => (
            <option key={t.id} value={t.id}>
              {dash.branches.find((b) => b.id === t.branch_id)?.name} ·{" "}
              {t.label}
              {t.pilot_enabled ? "" : " (disabled)"}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={!tid || working}
        onClick={async () => {
          if (
            link?.token &&
            !confirm(
              "Replace this table's code? Existing printed codes will stop working.",
            )
          )
            return;
          setWorking(true);
          try {
            const r = await mutate(endpoint);
            if (r) setLink(r);
          } finally {
            setWorking(false);
          }
        }}
      >
        {link?.token ? "Replace printed code" : "Create printed code"}
      </button>
      {url && image && (
        <>
          <div className="print-card">
            <h2>{dash.restaurant.name}</h2>
            <h3>{link.label}</h3>
            <img
              src={image}
              alt={`Join ${link.label}`}
              width={300}
              height={300}
            />
            <p>Scan to join your table</p>
            <small>Practice only · No real charges</small>
          </div>
          <div className="row wrap">
            <button onClick={() => window.print()}>Print QR card</button>
            <a
              className="button"
              download={`table-${link.tableId}.png`}
              href={image}
            >
              Download QR image
            </a>
            <a href={url} target="_blank" rel="noreferrer">
              Try guest link
            </a>
          </div>
          {createPortal(
            <div className="print-only-card">
              <h2>{dash.restaurant.name}</h2>
              <h3>{link.label}</h3>
              <img
                src={image}
                alt={`Join ${link.label}`}
                width={300}
                height={300}
              />
              <p>Scan to join your table</p>
              <small>Practice only · No real charges</small>
            </div>,
            document.body,
          )}
          <p>
            Anyone with this link can try joining an active table. A QR code is
            not proof that someone is physically present. Staff can revoke a
            guest or replace the session link.
          </p>
        </>
      )}
    </section>
  );
}

export function AuditPanel({ rid, token }: { rid: string; token: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(true);
  async function load(before = 0) {
    try {
      const r = await request<any[]>(
        `/restaurants/${rid}/audit?before=${before}`,
        token,
      );
      setRows((old) => (before ? [...old, ...r] : r));
      setMore(r.length === 50);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [rid, token]);
  return (
    <section className="card">
      <h2>Restaurant activity</h2>
      <p>Newest first. Access is restricted to this restaurant's managers.</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => void load()}>Refresh activity</button>
      {rows.map((r) => (
        <details key={r.id}>
          <summary>
            {r.action.replaceAll("_", " ")} ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </summary>
          <pre>{JSON.stringify(r.detail, null, 2)}</pre>
          <small>Staff / guest reference: {r.actor_id}</small>
        </details>
      ))}
      {more && rows.length > 0 && (
        <button onClick={() => void load(rows.at(-1).id)}>
          Older activity
        </button>
      )}
    </section>
  );
}
