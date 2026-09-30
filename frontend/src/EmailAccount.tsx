import { useState } from "react";
import { request } from "./api";

export type EmailConfig = { enabled: boolean; mode: string; testOnly: boolean };
export type EmailProfile = {
  email: string | null;
  pending_email: string | null;
  email_verified_at: string | null;
  email_verification_mode: string | null;
};
export type EmailDelivery = {
  purpose: string;
  delivery_status: string;
  expires_at: string;
};
type Run = (
  operation: () => Promise<void>,
  restoring?: boolean,
) => Promise<void>;
const text = (f: FormData, key: string) => String(f.get(key) ?? "");

export function EmailAccount({
  profile,
  config,
  delivery,
  token,
  disabled,
  restoring,
  run,
  reload,
  notice,
}: {
  profile: EmailProfile;
  config: EmailConfig;
  delivery: EmailDelivery[];
  token: string;
  disabled: boolean;
  restoring: boolean;
  run: Run;
  reload: () => Promise<void>;
  notice: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!config.enabled) return null;
  const verified =
    !!profile.email_verified_at &&
    profile.email_verification_mode === config.mode;
  const pending = delivery.find((d) => d.purpose === "VERIFY");
  const blocked = disabled && !restoring;
  return (
    <section className="email-account" aria-label="Email verification">
      <div className="spread">
        <div>
          <span className="eyebrow">Account email</span>
          <h3>{verified ? "Email verified in this demo" : "One more step"}</h3>
        </div>
        <span className={`pill ${verified ? "success" : ""}`}>
          {verified ? "TEST verified" : "Verify email"}
        </span>
      </div>
      <p>
        {verified
          ? profile.email
          : "Verify an email to save visits and recover your account."}
      </p>
      <p className="test-caption">
        Local test: messages appear in the desktop Mailpit inbox, not your real
        email. Ask the demo host for your code.
      </p>
      {profile.pending_email && (
        <>
          <p>
            Code sent to the test inbox for{" "}
            <strong>{profile.pending_email}</strong>.
          </p>
          {pending && (
            <p role="status" className="muted">
              {pending.delivery_status === "CANCELLED" ||
              Date.parse(pending.expires_at) <= Date.now()
                ? "This code expired or was cancelled. Request a new one."
                : pending.delivery_status === "FAILED"
                  ? "Delivery failed. Check Mailpit, then request a new code."
                  : pending.delivery_status === "QUEUED"
                    ? "Queued for the local inbox. Delivery will retry if it is unavailable."
                    : "Delivered to the local inbox."}
            </p>
          )}
          <form
            className="verification-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await request("/customer/email/verify", token, "POST", {
                  code: text(f, "code"),
                });
                await reload();
                notice(
                  "Email verified for this local demo. You can now link your table.",
                );
              }, restoring);
            }}
          >
            <label className="field">
              Email verification code
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
                autoComplete="one-time-code"
                placeholder="8-digit code"
                required
              />
            </label>
            <button className="primary" disabled={blocked}>
              Verify email
            </button>
          </form>
          <div className="row wrap">
            <button
              disabled={blocked}
              onClick={() =>
                void run(async () => {
                  await request("/customer/email/resend", token, "POST", {});
                  await reload();
                  notice(
                    "A new code is queued. Use the newest message. Resend is available once per minute.",
                  );
                }, restoring)
              }
            >
              Resend code
            </button>
            <button
              disabled={blocked}
              onClick={() => void run(reload, restoring)}
            >
              Check delivery
            </button>
          </div>
        </>
      )}
      {!editing && (
        <button
          className="text-button"
          disabled={blocked}
          onClick={() => setEditing(true)}
        >
          {profile.email || profile.pending_email
            ? "Change email"
            : "Add email"}
        </button>
      )}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await request("/customer/email/request", token, "POST", {
                email: text(f, "email"),
                password: text(f, "password"),
              });
              await reload();
              setEditing(false);
              notice("Check the local inbox for your verification code.");
            }, restoring);
          }}
        >
          <label className="field">
            New email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="field">
            Current password for email change
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <p className="muted">
            Your previous verified email stays active until the new code is
            accepted.
          </p>
          <div className="row wrap">
            <button className="primary" disabled={blocked}>
              Send verification code
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={blocked}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function EmailRecovery({
  disabled,
  run,
  onComplete,
  notice,
}: {
  disabled: boolean;
  run: Run;
  onComplete: () => void;
  notice: (text: string) => void;
}) {
  const [requested, setRequested] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void run(async () => {
          if (!requested) {
            const r = await request<{ message: string }>(
              "/customer/email/reset/request",
              undefined,
              "POST",
              { username, email },
            );
            notice(r.message);
            setRequested(true);
          } else {
            await request("/customer/email/reset/confirm", undefined, "POST", {
              username,
              email,
              code: text(f, "code"),
              newPassword: text(f, "password"),
            });
            onComplete();
            notice(
              "Password changed. Sign in and save a new recovery code in account security.",
            );
          }
        });
      }}
    >
      <p>
        Use the email you already verified. In this local demo, the code appears
        in Mailpit on the host computer.
      </p>
      <label className="field">
        Username
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          readOnly={requested}
          maxLength={32}
        />
      </label>
      <label className="field">
        Verified email
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          readOnly={requested}
          maxLength={254}
        />
      </label>
      {requested && (
        <>
          <label className="field">
            Password reset code
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{8}"
              minLength={8}
              maxLength={8}
              autoComplete="one-time-code"
              required
            />
          </label>
          <label className="field">
            New account password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
            />
          </label>
        </>
      )}
      <button className="primary" disabled={disabled}>
        {requested ? "Reset password with email" : "Send password reset code"}
      </button>
      {requested && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRequested(false)}
        >
          Change details or request another code
        </button>
      )}
    </form>
  );
}
