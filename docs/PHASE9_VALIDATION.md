# Phase 9 validation â€” Tablekind 0.9.0

Date: 2026-09-22. Implementation and observed checks are distinguished below.
Nothing here claims real email ownership, live payment/POS integration or production readiness. Native Windows acceptance was subsequently completed and is recorded in [WINDOWS_ACCEPTANCE.md](WINDOWS_ACCEPTANCE.md).

## Observed in this development environment

| Check | Result | Scope |
| --- | --- | --- |
| Java 21 backend compile and package | Passed | Includes new mail dependency, V7 and test compilation |
| Backend HTTP/SQL suite | 140 total: 135 passed, 5 skipped, 0 failures/errors | Supplementary PGlite; not native PostgreSQL/Flyway acceptance |
| Email subset within that suite | 13 total: 12 passed, 1 skipped | Verification, expiry, attempts, single-use, recovery/revocation, address changes, uniqueness and mocked queue delivery |
| Email configuration tests | 3 passed | External relay and hardened-mode rejection; OFF/local behavior |
| Frontend production build | Passed | TypeScript and Vite |
| Saved-request recovery checks | 7 passed | Original identity/key/body survives interruption; unsafe replacement is rejected |
| Operations helper tests | 7 passed | Unit checks with mocks; no Docker outage or restore executed |
| Local email browser scenario | Passed | Actual SMTP to Mailpit, wrong/correct verification code, reset, new-password sign-in and old-session rejection |
| Four-interface/accounts browser scenario | Passed | Owner/manager/waiter controls, anonymous join, optional verification/linking, second-browser same-guest recovery, platform login page |
| Operations browser scenario | Passed | Healthy status, unavailable response, recovery, mobile layout and paused TEST POS alert |
| Ten-step demo browser scenario | Passed | Lost-response recovery, role switching, exact split, simulated card/cash, TEST POS MATCH, management, local email account and fresh-table history |
| Payments browser regression | Passed | Interrupted join/order/payment recovery, exact splits, mixed TEST payments, refunds and reconciliation |
| POS browser regression | Passed | Owner connection controls, delivery, lost reply, one-ban discrepancy, catalog/kitchen import and pause/resume |
| Onboarding/security browser regression | Passed | Printed QR, service mode, menu language, staff entry, waiter MFA/recovery and HTTP 429 login throttling |
| Platform dashboard visual review | Passed with mocked API fixtures | Desktop/phone rendering only; not authenticated platform acceptance |
| Existing migrations | Passed | V1â€“V5 equal the original upload byte-for-byte; V6 equals the saved 0.8.0 source |

The sanitized backend suite counts are in
`docs/verification/phase9-backend-supplementary.json`. The seven browser scenario results are in
`docs/verification/phase9-browser.json`. The final source ZIP passed integrity and
exclusion checks: no Git metadata, environment files, dependencies, build outputs,
private keys, access tokens or database dumps. Public fictional test fixtures
remain in their original local-only source configuration.

## Supplementary database limits

The runtime used Java 21.0.12.1 and Maven 3.9.11 with a PGlite PostgreSQL WASM
18.3 database. Migration SQL V1â€“V7 was applied in order by the test harness;
Flyway was disabled. JDBC used simple query mode, one connection per application
context and a socket multiplexer. This is not the application's native
PostgreSQL 16 runtime and cannot prove multi-session locking behavior.

Five native-only concurrency tests were explicitly skipped: checkout reservation,
payment callback deduplication, POS worker claim, account linking and email-code
consumption. Require all 140 tests with zero skips on native PostgreSQL 16.
The backend email worker used mocked delivery in its security tests. Browser
email/demo tests separately exercised the actual local SMTP sender and Mailpit
v1.27.4. The browser used Chromium 153 on desktop and phone-size viewports. Most initial
browser fixtures ran with request throttling disabled in the disposable harness;
the POS and onboarding/security scenarios were rerun with it enabled, including
the explicit HTTP 429 assertion. Production/default limits remain enabled.

Early harness runs were blocked by unsupported prepared-query behavior and a
single-connection socket limit. These were corrected in the disposable harness;
no production database settings or native concurrency gates were weakened.
Browser navigation checks were updated for the new More menu and service tabs.
An observed demo-settings race that could replace a typed login email was fixed.
Browser review also found that the earlier POS screen recognized MANAGER but not
OWNER. It now uses the shared restaurant-management permission helper; owner POS
controls are covered by the browser regression.

## Not executed / still required

- Docker image builds and Compose health/startup on Windows.
- Native PostgreSQL 16 with Flyway, all concurrency tests and migration from an
  existing Phase 7D database, including the sole-platform-admin guard.
- Windows PowerShell scripts and private platform-administrator provisioning.
- Authenticated platform browser actions/MFA replacement, using privately
  provisioned credentials. Backend platform permission/MFA tests passed only in
  the supplementary suite; a rendered login screen does not prove provisioning.
- The user's existing Docker/Tailscale installation, private phones and inbox
  network isolation on that PC.
- Actual PostgreSQL/container outage, Mailpit-container restart, backup restoration
  and restored account/authenticator access with the original signing secret.
- Sustained load, external monitoring, delivery to real email inboxes, SMS,
  live POS/payment/fiscal services, public hosting and restaurant deployment.

See WINDOWS_UPDATE_AND_GIT.md for the exact project path, safe update sequence,
commands and review-before-push Git workflow. Keep private records, codes,
credentials, browser screenshots and database dumps out of commits and uploads.
The earlier Phase 7D/8 reports remain historical evidence for their own versions.
