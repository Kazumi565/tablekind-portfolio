import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, money, request } from "./api";
import type { Auth } from "./types";
import {
  EmailAccount,
  EmailRecovery,
  type EmailConfig,
  type EmailProfile,
  type EmailDelivery,
} from "./EmailAccount";

type Profile = {
  profile: {
    username: string;
    display_name: string;
    language: string;
  } & EmailProfile;
  emailSettings: EmailConfig;
  emailDelivery: EmailDelivery[];
  visits: {
    guest_id: string;
    session_id: string;
    nickname: string;
    restaurant_name: string;
    label: string;
    joined_at: string;
    status: string;
    active: boolean;
    allocated_bani: number;
    settled_bani: number;
  }[];
};
const value = (f: FormData, key: string) => String(f.get(key) ?? "");
const identity = (r: Auth): Auth => ({
  accessToken: r.accessToken,
  actorId: r.actorId,
  kind: r.kind,
});

export function CustomerPanel({
  customer,
  guest,
  blocked,
  onAuth,
  onResume,
  onClearGuest,
  onPreferences,
  onBusy,
  recoveryGuestId,
}: {
  customer: Auth | null;
  guest: Auth | null;
  blocked: boolean;
  onAuth: (a: Auth | null) => void;
  onResume: (a: Auth) => void;
  onClearGuest: () => void;
  onPreferences: (name: string, language: string) => void;
  onBusy: (busy: boolean) => void;
  recoveryGuestId?: string;
}) {
  const [view, setView] = useState<
    "login" | "register" | "recover" | "email-recover"
  >("login");
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setConfigError(false);
    void request<EmailConfig>("/customer/email/config")
      .then((c) => {
        if (active) setEmailConfig(c);
      })
      .catch(() => {
        if (active) setConfigError(true);
      });
    return () => {
      active = false;
    };
  }, [configAttempt]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const activeRequest = useRef(false);
  const disabled = busy || blocked;
  const load = async () => {
    if (!customer) return;
    const data = await request<Profile>("/customer/me", customer.accessToken);
    setProfile(data);
    onPreferences(data.profile.display_name, data.profile.language);
  };
  useEffect(() => {
    let active = true;
    setProfile(null);
    if (customer)
      void request<Profile>("/customer/me", customer.accessToken)
        .then((data) => {
          if (active) {
            setProfile(data);
            onPreferences(data.profile.display_name, data.profile.language);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            if (e instanceof ApiError && e.status === 401) onAuth(null);
          }
        });
    return () => {
      active = false;
    };
  }, [customer?.accessToken]);
  const run = async (operation: () => Promise<void>, restoring = false) => {
    if (activeRequest.current || (disabled && !(restoring && recoveryGuestId)))
      return;
    activeRequest.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      activeRequest.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    void run(async () => {
      const body =
        view === "recover"
          ? {
              username: value(f, "username"),
              recoveryCode: value(f, "recoveryCode"),
              newPassword: value(f, "password"),
            }
          : {
              username: value(f, "username"),
              password: value(f, "password"),
              ...(view === "register"
                ? {
                    displayName: value(f, "displayName"),
                    language: value(f, "language"),
                    ...(emailConfig?.enabled
                      ? { email: value(f, "email") }
                      : {}),
                  }
                : {}),
            };
      const r = await request<Auth & { recoveryCode?: string }>(
        `/customer/${view}`,
        undefined,
        "POST",
        body,
      );
      form.reset();
      if (r.recoveryCode) setRecoveryCode(r.recoveryCode);
      if (view === "recover") {
        setView("login");
        setNotice(
          "Password reset. Sign in with your new password and save the replacement recovery code.",
        );
      } else onAuth(identity(r));
    }, view === "login");
  };
  const endAccountSession = () => {
    if (profile?.visits.some((v) => v.guest_id === guest?.actorId))
      onClearGuest();
    onAuth(null);
    setProfile(null);
    setRecoveryCode("");
  };
  return (
    <section className="card customer-panel" aria-label="My account">
      <span className="eyebrow">Your Tablekind</span>
      <h2>{customer ? "My account" : "Keep your visits together"}</h2>
      <p>An account is optional. You can always join and order as a guest.</p>
      {!customer && configError && (
        <div className="notice" role="alert">
          <p>
            Account settings could not load. Sign-in is still available; retry
            to create an account or use email recovery.
          </p>
          <button onClick={() => setConfigAttempt((n) => n + 1)}>
            Retry account settings
          </button>
        </div>
      )}
      {blocked && (
        <p className="notice">
          Finish the saved table request before making account changes. If guest
          access expired, sign in to the linked account and resume that same
          guest, then retry the saved request.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {recoveryCode && (
        <div className="notice recovery-note">
          <strong>Save your recovery code privately</strong>
          <p>
            This replaces any previous code. Keep it as a backup if you cannot
            use email recovery.
          </p>
          <code>{recoveryCode}</code>
          <button onClick={() => setRecoveryCode("")}>
            I saved my recovery code
          </button>
        </div>
      )}
      {!customer ? (
        <>
          <div className="chips">
            {(["login", "register"] as const).map((v) => (
              <button
                key={v}
                disabled={disabled && !(v === "login" && recoveryGuestId)}
                className={v === view ? "active" : ""}
                onClick={() => {
                  setView(v);
                  setError("");
                }}
              >
                {v === "login" ? "Account sign in" : "Create optional account"}
              </button>
            ))}
          </div>
          {view === "email-recover" ? (
            <EmailRecovery
              disabled={disabled}
              run={run}
              onComplete={() => setView("login")}
              notice={setNotice}
            />
          ) : (
            <form onSubmit={submit} key={view}>
              <label className="field">
                Username
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_]+"
                  autoComplete="username"
                />
              </label>
              {view === "register" && (
                <>
                  {emailConfig?.enabled && (
                    <label className="field">
                      Email address
                      <input
                        name="email"
                        aria-label="Email address"
                        aria-describedby="registration-email-help"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        required
                      />
                      <small id="registration-email-help">
                        Verification messages go to the local test inbox.
                      </small>
                    </label>
                  )}
                  <label className="field">
                    Display name
                    <input name="displayName" required maxLength={40} />
                  </label>
                  <details>
                    <summary>Menu language</summary>
                    <Language />
                  </details>
                </>
              )}
              {view === "recover" && (
                <label className="field">
                  Recovery code
                  <input
                    name="recoveryCode"
                    required
                    maxLength={64}
                    autoComplete="off"
                  />
                </label>
              )}
              <label className="field">
                {view === "login" ? "Account password" : "New account password"}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={view === "login" ? undefined : 12}
                  maxLength={72}
                  autoComplete={
                    view === "login" ? "current-password" : "new-password"
                  }
                />
              </label>
              {view === "register" && (
                <p className="muted">
                  Use a unique username, 3–32 letters, digits or underscores.
                  Keep your recovery code. Only the visits you explicitly link
                  appear here.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  (disabled && !(view === "login" && recoveryGuestId)) ||
                  (view === "register" && !emailConfig)
                }
              >
                {view === "login"
                  ? "Sign in to customer account"
                  : view === "register"
                    ? "Create customer account"
                    : "Reset account password"}
              </button>
            </form>
          )}
          <div className="account-recovery-links">
            {emailConfig?.enabled && (
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => {
                  setView("email-recover");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            )}
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => {
                setView("recover");
                setError("");
              }}
            >
              Use a recovery code
            </button>
          </div>
        </>
      ) : profile ? (
        <>
          <h3>
            {profile.profile.display_name}{" "}
            <small>@{profile.profile.username}</small>
          </h3>
          <EmailAccount
            profile={profile.profile}
            config={profile.emailSettings}
            delivery={profile.emailDelivery}
            token={customer.accessToken}
            disabled={disabled}
            restoring={!!recoveryGuestId && !busy}
            run={run}
            reload={load}
            notice={setNotice}
          />
          {guest &&
            !profile.visits.some((v) => v.guest_id === guest.actorId) && (
              <button
                className="primary"
                disabled={
                  disabled ||
                  (profile.emailSettings.enabled &&
                    !profile.profile.email_verified_at)
                }
                onClick={() =>
                  void run(async () => {
                    await request(
                      "/customer/table-link",
                      customer.accessToken,
                      "POST",
                      { guestToken: guest.accessToken },
                    );
                    await load();
                    setNotice("Your current table is linked to this account.");
                  })
                }
              >
                Link my current table
              </button>
            )}
          <h3>Your visits</h3>
          <p className="muted">
            Latest 100 linked visits. Your share and its settled amount are
            shown; another guest may have covered part of it.
          </p>
          {profile.visits.length === 0 && (
            <p>
              No linked visits yet. Join a table, then choose Link my current
              table.
            </p>
          )}
          <div className="visit-list">
            {profile.visits.map((v) => (
              <article className="card" key={v.guest_id}>
                <strong>
                  {v.restaurant_name} · {v.label}
                </strong>
                <p>
                  {v.nickname} · {new Date(v.joined_at).toLocaleDateString()} ·{" "}
                  {v.status.toLowerCase()}
                </p>
                <p>
                  My share {money(v.allocated_bani)} · Settled{" "}
                  {money(v.settled_bani)}
                </p>
                {v.status === "OPEN" && v.active && (
                  <button
                    disabled={disabled && recoveryGuestId !== v.guest_id}
                    onClick={() =>
                      void run(async () => {
                        if (
                          guest &&
                          guest.actorId !== v.guest_id &&
                          !confirm(
                            "Switch to this saved table? Your current table and any unpaid share remain unchanged.",
                          )
                        )
                          return;
                        const resumed = await request<Auth>(
                          `/customer/visits/${v.guest_id}/resume`,
                          customer.accessToken,
                          "POST",
                          {},
                        );
                        onResume(resumed);
                        setNotice("Returned to your original table guest.");
                      }, recoveryGuestId === v.guest_id)
                    }
                  >
                    Resume this table
                  </button>
                )}
              </article>
            ))}
          </div>
          <details>
            <summary>Preferences and account security</summary>
            <form
              key={
                profile.profile.username +
                profile.profile.display_name +
                profile.profile.language
              }
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await request(
                    "/customer/preferences",
                    customer.accessToken,
                    "PUT",
                    {
                      displayName: value(f, "displayName"),
                      language: value(f, "language"),
                    },
                  );
                  await load();
                  setNotice("Preferences saved.");
                });
              }}
            >
              <label className="field">
                Display name
                <input
                  name="displayName"
                  required
                  maxLength={40}
                  defaultValue={profile.profile.display_name}
                />
              </label>
              <Language initial={profile.profile.language} />
              <button disabled={disabled}>Save preferences</button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await request(
                    "/customer/password",
                    customer.accessToken,
                    "POST",
                    {
                      password: value(f, "password"),
                      newPassword: value(f, "newPassword"),
                    },
                  );
                  endAccountSession();
                  setNotice(
                    "Password changed. Sign in again; linked table access on other devices was revoked.",
                  );
                });
              }}
            >
              <label className="field">
                Current account password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label className="field">
                Replacement password
                <input
                  name="newPassword"
                  type="password"
                  minLength={12}
                  maxLength={72}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button disabled={disabled}>Change account password</button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                void run(async () => {
                  const r = await request<{ recoveryCode: string }>(
                    "/customer/recovery-code",
                    customer.accessToken,
                    "POST",
                    { password: value(f, "password") },
                  );
                  setRecoveryCode(r.recoveryCode);
                  form.reset();
                });
              }}
            >
              <label className="field">
                Password to replace recovery code
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button disabled={disabled}>Replace recovery code</button>
            </form>
            <button
              disabled={disabled}
              onClick={() =>
                void run(async () => {
                  await request(
                    "/customer/logout-all",
                    customer.accessToken,
                    "POST",
                    {},
                  );
                  endAccountSession();
                  setNotice(
                    "All account and linked table sign-ins revoked. You can sign in and resume active visits again.",
                  );
                })
              }
            >
              Sign out all devices
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  !confirm(
                    "Delete your optional account and unlink your history? Restaurant financial records remain. All linked tables must be closed first.",
                  )
                )
                  return;
                void run(async () => {
                  await request(
                    "/customer/delete",
                    customer.accessToken,
                    "POST",
                    { password: value(f, "password") },
                  );
                  endAccountSession();
                  setNotice(
                    "Account deleted. Restaurant financial records remain.",
                  );
                });
              }}
            >
              <label className="field">
                Password to delete account
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button disabled={disabled}>Delete customer account</button>
            </form>
          </details>
          <button disabled={disabled} onClick={endAccountSession}>
            Sign out of account and linked table
          </button>
        </>
      ) : (
        <p>Loading your account…</p>
      )}
    </section>
  );
}
function Language({ initial = "en" }: { initial?: string }) {
  return (
    <label className="field">
      Preferred menu language
      <select name="language" defaultValue={initial}>
        <option value="en">English</option>
        <option value="ro">Română</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
