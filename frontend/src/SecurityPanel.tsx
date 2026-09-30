import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { request } from "./api";

export function SecurityPanel({
  token,
  onSignOut,
}: {
  token: string;
  onSignOut: () => void;
}) {
  const [status, setStatus] = useState<{
    mfaEnabled: boolean;
    recoveryCodesRemaining: number;
    recentEvents: { action: string; created_at: string }[];
  } | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null,
  );
  const [qr, setQr] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    request<typeof status>("/auth/security", token)
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    if (setup)
      void QRCode.toDataURL(setup.uri)
        .then(setQr)
        .catch((e) => setError(e.message));
  }, [setup]);
  async function run(path: string, body: unknown = { password, code }) {
    setBusy(true);
    setError("");
    try {
      return await request<any>(path, token, "POST", body);
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  if (codes)
    return (
      <section className="card">
        <h2>Save your recovery codes now</h2>
        <p>
          Two-step sign-in is enabled and old sessions are signed out. Store
          these codes somewhere private. Each can be used once; this list is
          shown only now. Losing both the authenticator and these codes requires
          administrator-assisted recovery.
        </p>
        <pre>{codes.join("\n")}</pre>
        <button className="primary" onClick={onSignOut}>
          I saved them — sign in again
        </button>
      </section>
    );
  return (
    <section className="card security-panel">
      <h2>My account security</h2>
      <details>
        <summary>Recent account activity</summary>
        {status?.recentEvents?.map((event, i) => (
          <p key={i}>
            {event.action.replaceAll("_", " ")} ·{" "}
            {new Date(event.created_at).toLocaleString()}
          </p>
        ))}
      </details>
      <p>
        Two-step sign-in:{" "}
        {status ? (status.mfaEnabled ? "Enabled" : "Not enabled") : "Loading"}
        {status?.mfaEnabled
          ? ` · ${status.recoveryCodesRemaining} recovery codes left`
          : ""}
        .
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label className="field">
        Current password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        Authenticator or recovery code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          autoComplete="one-time-code"
          maxLength={64}
        />
      </label>
      {!status?.mfaEnabled && !setup && (
        <button
          disabled={busy || !password}
          onClick={async () => {
            const r = await run("/auth/mfa/setup");
            if (r) setSetup(r);
          }}
        >
          Set up authenticator
        </button>
      )}
      {setup && (
        <div>
          <p>
            Scan with your authenticator app, then enter its six-digit code
            above. Setup expires after ten minutes. Never share this key.
          </p>
          {qr && (
            <img
              src={qr}
              alt="Authenticator enrollment QR"
              width={220}
              height={220}
            />
          )}
          <p className="secret-text">Manual key: {setup.secret}</p>
          <button
            className="primary"
            disabled={busy || !code}
            onClick={async () => {
              const r = await run("/auth/mfa/enable");
              if (r) {
                setSetup(null);
                setQr("");
                setPassword("");
                setCode("");
                setCodes(r.recoveryCodes);
              }
            }}
          >
            Enable two-step sign-in
          </button>
        </div>
      )}
      {status?.mfaEnabled && (
        <button
          disabled={busy || !password || !code}
          onClick={async () => {
            if (
              confirm("Disable two-step sign-in and sign out every session?")
            ) {
              const r = await run("/auth/mfa/disable");
              if (r) onSignOut();
            }
          }}
        >
          Disable two-step sign-in
        </button>
      )}
      <details>
        <summary>Change password</summary>
        <label className="field">
          New password
          <input
            type="password"
            minLength={12}
            maxLength={72}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button
          disabled={busy || !password || next.length < 12}
          onClick={async () => {
            const r = await run("/auth/password", {
              password,
              newPassword: next,
              code,
            });
            if (r) onSignOut();
          }}
        >
          Change password and sign out
        </button>
      </details>
      <details>
        <summary>Lost device or shared computer?</summary>
        <p>Revoke all current sign-ins for this account.</p>
        <button
          disabled={busy}
          onClick={async () => {
            if (confirm("Sign out this account on every device?")) {
              const r = await run("/auth/logout-all", {});
              if (r) onSignOut();
            }
          }}
        >
          Sign out everywhere
        </button>
      </details>
    </section>
  );
}
