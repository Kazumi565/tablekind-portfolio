import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, request } from "./api";
import type { Auth } from "./types";

type Restaurant = {
  id: string;
  name: string;
  owner_email: string | null;
  branches: number;
  open_tables: number;
  staff_count: number;
  failed_pos_messages: number;
};
type Overview = {
  restaurants: Restaurant[];
  audit: {
    action: string;
    restaurant_id: string | null;
    reason: string;
    created_at: string;
  }[];
};
type Draft = {
  actorId: string;
  key: string;
  rid: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  reason: string;
};
const draftKey = "tablekind.platformDraft.v1";
const fvalue = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
function readDraft(): Draft | null {
  const raw = sessionStorage.getItem(draftKey);
  if (!raw) return null;
  const value = JSON.parse(raw);
  const fields = [
    "actorId",
    "key",
    "rid",
    "name",
    "ownerName",
    "ownerEmail",
    "reason",
  ];
  if (
    !value ||
    fields.some((k) => typeof value[k] !== "string") ||
    Object.keys(value).some((k) => !fields.includes(k)) ||
    !/^[a-f0-9-]{36}$/.test(value.key) ||
    !/^[a-f0-9-]{36}$/.test(value.actorId) ||
    (value.rid && !/^[a-f0-9-]{36}$/.test(value.rid))
  )
    throw new Error(
      "Saved administrator request is unreadable. Review the platform records before clearing this tab.",
    );
  return value;
}

export default function PlatformApp() {
  const [restored] = useState(() => {
    try {
      return { draft: readDraft(), error: "" };
    } catch (e) {
      return { draft: null, error: (e as Error).message };
    }
  });
  const [auth, setAuth] = useState<Auth | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("platform") ?? "null");
    } catch {
      return null;
    }
  });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(restored.draft);
  const [error, setError] = useState(restored.error),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [screen, setScreen] = useState<
      "overview" | "create" | "assign" | "audit" | "security"
    >(restored.draft ? (restored.draft.rid ? "assign" : "create") : "overview");
  const [secret, setSecret] = useState(""),
    [recovery, setRecovery] = useState("");
  const active = useRef(false);
  const forget = () => {
    sessionStorage.removeItem("platform");
    setAuth(null);
    setOverview(null);
  };
  const load = async () => {
    if (auth)
      setOverview(
        await request<Overview>("/platform/overview", auth.accessToken),
      );
  };
  useEffect(() => {
    let live = true;
    if (auth)
      void request<Overview>("/platform/overview", auth.accessToken)
        .then((data) => {
          if (live) setOverview(data);
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            if (e instanceof ApiError && e.status === 401) forget();
          }
        });
    return () => {
      live = false;
    };
  }, [auth?.accessToken]);
  const run = async (op: () => Promise<void>) => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await op();
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ApiError &&
        ["UNAUTHENTICATED", "TOKEN_REVOKED", "RECENT_LOGIN_REQUIRED"].includes(
          e.code,
        )
      )
        forget();
    } finally {
      active.current = false;
      setBusy(false);
    }
  };
  const proof = (f: FormData) => ({
    password: String(f.get("adminPassword") ?? ""),
    code: fvalue(f, "code"),
  });
  const command = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    void run(async () => {
      if (!auth || restored.error)
        throw new Error(restored.error || "Sign in first.");
      const saved: Draft = draft ?? {
        actorId: auth.actorId,
        key: crypto.randomUUID(),
        rid: screen === "assign" ? fvalue(f, "rid") : "",
        name: fvalue(f, "name"),
        ownerName: fvalue(f, "ownerName"),
        ownerEmail: fvalue(f, "ownerEmail"),
        reason: fvalue(f, "reason"),
      };
      if (saved.actorId !== auth.actorId)
        throw new Error(
          "Use the administrator account that sent this saved request.",
        );
      sessionStorage.setItem(draftKey, JSON.stringify(saved));
      setDraft(saved);
      await request(
        saved.rid
          ? `/platform/restaurants/${saved.rid}/owner`
          : "/platform/restaurants",
        auth.accessToken,
        "POST",
        {
          ...(saved.rid
            ? {}
            : {
                name: saved.name,
                ownerName: saved.ownerName,
                ownerPassword: String(f.get("ownerPassword") ?? ""),
              }),
          ownerEmail: saved.ownerEmail,
          reason: saved.reason,
          proof: proof(f),
        },
        saved.key,
      );
      sessionStorage.removeItem(draftKey);
      setDraft(null);
      form.reset();
      await load();
      setScreen("overview");
      setNotice("Restaurant access saved and audited.");
    });
  };
  return (
    <>
      <header className="platform-header">
        <a className="brand" href="/admin">
          <span className="mark">t</span>tablekind{" "}
          <span className="local-label">platform admin</span>
        </a>
        {auth && (
          <button
            disabled={busy || !!draft}
            onClick={() =>
              void run(async () => {
                await request("/platform/logout", auth.accessToken, "POST", {});
                forget();
              })
            }
          >
            Sign out administrator
          </button>
        )}
      </header>
      <main className="platform-workspace" aria-busy={busy}>
        <div className="page-title">
          <div>
            <span className="eyebrow">Private platform administration</span>
            <h1>Your platform</h1>
            <p>Restaurants, ownership and your account security.</p>
          </div>
          <span className="pill">TEST providers only</span>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {recovery && (
          <div className="notice recovery-note">
            <strong>Save the new recovery code privately</strong>
            <code>{recovery}</code>
            <button onClick={() => setRecovery("")}>I saved it</button>
          </div>
        )}
        {!auth ? (
          <form
            className="card login"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const form = e.currentTarget;
              void run(async () => {
                const a = await request<Auth>(
                  "/platform/login",
                  undefined,
                  "POST",
                  {
                    email: fvalue(f, "email"),
                    password: String(f.get("password") ?? ""),
                    code: fvalue(f, "code"),
                  },
                );
                if (draft && draft.actorId !== a.actorId)
                  throw new Error(
                    "Sign in as the administrator who sent the saved request.",
                  );
                sessionStorage.setItem("platform", JSON.stringify(a));
                setAuth(a);
                form.reset();
              });
            }}
          >
            <h2>Administrator sign in</h2>
            <p>
              This account is provisioned privately by the platform operator.
              Restaurant credentials do not grant access here.
            </p>
            <label className="field">
              Administrator email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label className="field">
              Administrator password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              Authenticator or recovery code
              <input
                name="code"
                required
                autoComplete="one-time-code"
                maxLength={64}
              />
            </label>
            <button className="primary" disabled={busy}>
              Sign in to platform
            </button>
          </form>
        ) : (
          <>
            {draft && (
              <div className="notice">
                <strong>
                  A saved administrator request needs confirmation.
                </strong>
                <p>
                  Retry with the same owner password where required and a fresh
                  administrator code. Business fields and the request key are
                  preserved.
                </p>
                <button
                  disabled={busy}
                  onClick={() => setScreen(draft.rid ? "assign" : "create")}
                >
                  Review saved request
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Have you reviewed restaurant ownership and audit records? Discarding this local request does not undo any server change.",
                      )
                    ) {
                      sessionStorage.removeItem(draftKey);
                      setDraft(null);
                      setScreen("overview");
                    }
                  }}
                >
                  Discard after reviewing records
                </button>
              </div>
            )}
            <nav className="tabs" aria-label="Platform sections">
              {(["overview", "audit", "security"] as const).map((s) => (
                <button
                  key={s}
                  className={s === screen ? "active" : ""}
                  disabled={
                    busy ||
                    (!!draft &&
                      ![
                        "overview",
                        "audit",
                        draft.rid ? "assign" : "create",
                      ].includes(s))
                  }
                  onClick={() => setScreen(s)}
                >
                  {
                    {
                      overview: "Restaurants",
                      create: "Provision restaurant",
                      assign: "Assign legacy owner",
                      audit: "Platform audit",
                      security: "Admin security",
                    }[s]
                  }
                </button>
              ))}
            </nav>
            {screen === "overview" && (
              <section>
                <div className="spread wrap">
                  <h2>Restaurants</h2>
                  <button
                    className="primary"
                    disabled={busy || !!draft}
                    onClick={() => setScreen("create")}
                  >
                    Add restaurant
                  </button>
                  <button disabled={busy} onClick={() => void run(load)}>
                    Refresh platform
                  </button>
                </div>
                <p className="muted">
                  Latest 200 restaurants. No table-level customer data or
                  payment controls are exposed here.
                </p>
                <label className="field platform-search">
                  <span className="sr-only">Find restaurant</span>
                  <input
                    type="search"
                    aria-label="Find restaurant"
                    placeholder="Find a restaurant…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {overview && !overview.restaurants.length && (
                  <div className="empty card">
                    <h3>Your first restaurant starts here</h3>
                    <p>Add a restaurant and its owner to get started.</p>
                  </div>
                )}
                <div className="platform-restaurants">
                  {overview?.restaurants
                    .filter((r) =>
                      r.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((r) => (
                      <article className="card" key={r.id}>
                        <h3>{r.name}</h3>
                        <p>{r.owner_email ?? "Owner assignment required"}</p>
                        <p>
                          {r.branches} branches · {r.staff_count} staff ·{" "}
                          {r.open_tables} open tables
                        </p>
                        {r.failed_pos_messages > 0 && (
                          <p className="error">
                            {r.failed_pos_messages} TEST POS messages need
                            review
                          </p>
                        )}
                        {!r.owner_email && (
                          <button
                            disabled={busy || !!draft}
                            onClick={() => setScreen("assign")}
                          >
                            Review owner assignment
                          </button>
                        )}
                        <details>
                          <summary>Restaurant reference</summary>
                          <small>{r.id}</small>
                        </details>
                      </article>
                    ))}
                </div>
              </section>
            )}
            {(screen === "create" || screen === "assign") && (
              <form
                className="card platform-form"
                key={screen + (draft?.key ?? "")}
                onSubmit={command}
              >
                <h2>
                  {screen === "create"
                    ? "Provision restaurant and owner"
                    : "Assign an owner to a legacy restaurant"}
                </h2>
                {screen === "create" ? (
                  <>
                    <label className="field">
                      Restaurant name
                      <input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={draft?.name}
                        readOnly={!!draft}
                      />
                    </label>
                    <label className="field">
                      Owner name
                      <input
                        name="ownerName"
                        required
                        maxLength={80}
                        defaultValue={draft?.ownerName}
                        readOnly={!!draft}
                      />
                    </label>
                  </>
                ) : (
                  <label className="field">
                    Restaurant
                    <select
                      name="rid"
                      required
                      defaultValue={draft?.rid ?? ""}
                      disabled={!!draft}
                    >
                      <option value="" disabled>
                        Choose an unassigned restaurant
                      </option>
                      {overview?.restaurants
                        .filter((r) => !r.owner_email || r.id === draft?.rid)
                        .map((r) => (
                          <option value={r.id} key={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Owner email
                  <input
                    name="ownerEmail"
                    required
                    type="email"
                    maxLength={254}
                    defaultValue={draft?.ownerEmail}
                    readOnly={!!draft}
                  />
                </label>
                {screen === "create" ? (
                  <label className="field">
                    Initial owner password
                    <input
                      name="ownerPassword"
                      type="password"
                      minLength={12}
                      maxLength={72}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                ) : (
                  <p>
                    The email must belong to an active manager already assigned
                    to this restaurant. Existing ownership cannot be overwritten
                    here.
                  </p>
                )}
                <label className="field">
                  Reason
                  <input
                    name="reason"
                    required
                    maxLength={400}
                    defaultValue={draft?.reason}
                    readOnly={!!draft}
                  />
                </label>
                <AdminProof />
                <button className="primary" disabled={busy || !!restored.error}>
                  {draft
                    ? "Retry saved administrator request"
                    : "Save restaurant access"}
                </button>
              </form>
            )}
            {screen === "audit" && (
              <section className="card">
                <h2>Recent platform actions</h2>
                <p>Latest 100 entries.</p>
                {overview?.audit.map((e, i) => (
                  <article className="audit-row" key={i}>
                    <strong>{e.action}</strong>
                    <p>{e.reason}</p>
                    <small>
                      {new Date(e.created_at).toLocaleString()} ·{" "}
                      {e.restaurant_id ?? "Platform account"}
                    </small>
                  </article>
                ))}
              </section>
            )}
            {screen === "security" && (
              <section className="card platform-form">
                <h2>Replace administrator security</h2>
                <p>
                  Complete this within five minutes of signing in with your
                  authenticator or recovery code. Set up the new authenticator
                  before replacing your password and revoking all administrator
                  sessions.
                </p>
                {!secret ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const r = await request<{ secret: string }>(
                          "/platform/security/setup",
                          auth.accessToken,
                          "POST",
                          { password: String(f.get("adminPassword") ?? "") },
                        );
                        setSecret(r.secret);
                      });
                    }}
                  >
                    <AdminPassword />
                    <button disabled={busy || !!draft}>
                      Start authenticator replacement
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="notice recovery-note">
                      <p>
                        Add this secret to an authenticator: SHA1, 6 digits, 30
                        seconds.
                      </p>
                      <code>{secret}</code>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          const r = await request<{ recoveryCode: string }>(
                            "/platform/security",
                            auth.accessToken,
                            "POST",
                            {
                              newPassword: String(f.get("newPassword") ?? ""),
                              newCode: fvalue(f, "newCode"),
                              password: String(f.get("adminPassword") ?? ""),
                            },
                          );
                          setRecovery(r.recoveryCode);
                          setSecret("");
                          forget();
                          setNotice(
                            "Security replaced. Sign in using the new password and authenticator.",
                          );
                        });
                      }}
                    >
                      <label className="field">
                        New administrator password
                        <input
                          name="newPassword"
                          type="password"
                          minLength={12}
                          maxLength={72}
                          required
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="field">
                        Code from new authenticator
                        <input
                          name="newCode"
                          required
                          pattern="[0-9]{6}"
                          autoComplete="one-time-code"
                        />
                      </label>
                      <AdminPassword />
                      <button disabled={busy || !!draft}>
                        Confirm new security and sign out
                      </button>
                    </form>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <footer>Tablekind · Private administration · TEST integrations</footer>
    </>
  );
}
function AdminProof() {
  return (
    <fieldset>
      <legend>Confirm administrator identity</legend>
      <label className="field">
        Current administrator password
        <input
          name="adminPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        Fresh administrator code
        <input
          name="code"
          required
          maxLength={64}
          autoComplete="one-time-code"
        />
      </label>
    </fieldset>
  );
}
function AdminPassword() {
  return (
    <label className="field">
      Current administrator password
      <input
        name="adminPassword"
        type="password"
        required
        autoComplete="current-password"
      />
    </label>
  );
}
