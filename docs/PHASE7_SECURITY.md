# Phase 7 account and access controls

This documents the Phase 7A–C implementation and its limits. The app still uses the TEST payment and POS providers.

Phase 8 extends this with OWNER membership and separate platform/customer
identities. See PHASE8_ACCOUNTS.md for the current account boundaries.

## Roles and sensitive actions

- Restaurant and session access is scoped to current membership. Token version is checked on every API request; removed membership blocks that restaurant even if the JWT has not expired.
- Setup, printed QR management, restaurant activity, POS dashboard/controls, bill adjustments/refunds and reconciliation require a manager. These gates run before replay of a saved command response.
- Waiters handle submitted orders, kitchen status, availability, assistance, table opening/closing, session QR rotation and confirmed cash/terminal collection. Cancelling accepted/preparing food is a manager correction.
- Guests cannot confirm manual money collection, modify setup or refund payments. Existing financial reservation/consent rules still apply.
- The browser keeps bearer tokens in sessionStorage and sends an explicit Authorization header. Authentication does not use cookies. Never publish the local profile or its sample credentials. The demo keeps its generated secrets and network restriction.

## Account security

Optional TOTP uses RFC 6238, HMAC-SHA1, six digits and a 30-second step. The previous/current/next step is accepted for clock drift, but a successful step cannot be used twice. Enrollment requires the current password and a correct code, expires after ten minutes, and replaces old pending enrollment. Sensitive account changes re-check token version after locking the staff row.

Eight 128-bit recovery codes are displayed once. Only SHA-256 hashes are stored; each code is consumed on use. Enabling/disabling two-step sign-in or changing the password increments token version and signs out existing sessions. A fresh authenticator code or unused recovery code is required for subsequent sensitive changes. If a response is lost, sign in again with a fresh code; do not assume the change failed. Recovery codes are not saved in command receipts.

TOTP seeds are encrypted using AES-256-GCM, a random nonce and the staff ID as authenticated data. The encryption key is derived separately from the JWT secret. **Preserve the original JWT secret alongside the database backup: changing it invalidates sessions and printed signatures and prevents decryption of existing MFA seeds.** A dedicated keyring and rotation/re-encryption procedure are later deployment work. Do not rotate this key casually.

There is no automated email reset or manager bypass for another user's MFA. Losing both the authenticator and all recovery codes requires a deliberate administrator recovery procedure, outside this UI. Do not enable MFA on an account unless its recovery codes can be stored safely.

Successful and failed sign-ins, recovery use and account-security changes produce append-only security events. Each account can view its latest twenty events. Managers can page through restaurant activity. Passwords, OTP values, recovery codes and seeds are not written into these events. Join-token paths are redacted from unexpected-error logs.

## Rate limits

Database-backed fixed windows are shared across app processes and survive restart. Defaults per minute:

| Scope | Maximum attempts |
| --- | ---: |
| Login for one normalized email | 10 |
| Security changes for one account | 10 |
| Public login/join/QR access from one remote address | 120 |
| Authenticated mutations from one actor | 180 |

HTTP 429 includes `Retry-After: 60`. Counters store hashed identities and expired buckets are pruned. Limits use the socket's remote address, not arbitrary X-Forwarded-For headers. A reverse proxy can therefore share the public quota between clients; tune trusted-edge limits for a real installation. These limits reduce abuse but are not a DDoS defense or an account-lockout policy. The demo Nginx login throttle remains in place too.

Repeated backend fixtures disable global limits; dedicated tests exercise persisted counters and the browser suite verifies an actual 429 response. Do not disable limits on a remotely accessible installation.

## QR and guest sessions

Temporary session tokens remain random, hash-stored, revocable and valid for up to 24 hours. Printed QR locators are HMAC-signed and bound to the table's revocable version. They only resolve while a table is enabled and has an open, unexpired staff-created session. A stale session ID cannot join a new group. Reusing the same request key restores the original guest; revoked guests cannot recover their old sign-in through that receipt.

Replacing a printed code invalidates old printed links. Rotating the temporary session QR does not replace the printed locator. Closing the session stops all new joins; it does not erase bills or confirmations. Removing guest access requires resolving their orders/shares first and never deletes financial records.

A photographed QR can still be used remotely during an open session. Neither a signed link nor Tailscale proves presence at a physical table. A waiter check or fresh seating PIN would be needed if a future restaurant requires stronger presence checks.

## References

- [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) for the algorithm and known-vector tests.
- [Spring Security response headers](https://docs.spring.io/spring-security/reference/servlet/exploits/headers.html) for framework defaults. The supplied Nginx configs also retain CSP and no-referrer headers.

Phase 7D will address broader operational evidence. Real-provider contracts, fiscal integration, secure deployment and restaurant acceptance remain separate requirements.
