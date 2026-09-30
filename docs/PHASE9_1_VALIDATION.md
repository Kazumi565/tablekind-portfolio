# 0.9.1 review and acceptance

## Implemented

New V8 aggregate measurement schema and scoped manager report; V9 local/demo-only practice reservation schema and workflows; atomic idempotent starter setup; role, scoping, starter and reservation HTTP regressions; manager/guest practice screens and updated demo guide; mobile/accessibility browser smoke script; removed the guest nickname from future join audit details. The existing optional-account lifecycle already includes password change, single-use recovery code, local email reset and email change/reverification, account deletion subject to closed visits, current-tab sign-out and all-device token revocation. This update did not invent a live email/SMS provider.

## Actually tested

In the review environment on 24 September 2026, the Java 21 compile/package and React/TypeScript production build passed. With all V1–V9 SQL migrations applied to a disposable PostgreSQL-compatible PGlite database, the final backend suite passed **151 tests: 146 passed, 5 native-only concurrency tests skipped, 0 failures/errors**. This is supplementary PostgreSQL-compatible evidence, **not** a native PostgreSQL 16 or Docker result. An isolated Chromium/local-profile browser run passed manager and guest screens at six viewport widths (320/390/430/768/1024/1366 px), programmatic form labels, keyboard focus, primary button contrast, loading states and first-table double-tap prevention. The test caught 13 px input text and guest screen overflow at 320 px; both were corrected before the passing run. The PGlite suite does not certify native Flyway deployment or production load behavior.

The **disposable** demo-profile Chromium smoke passed the updated 11-step walkthrough: idempotent demo creation after a lost response, same-phone role switching, exact shared-bill consent, TEST card/cash settlement, TEST POS reconciliation, local Mailpit account verification, guest practice reservation, manager practice approval, fresh-scenario preservation and sign-out. This did not contact the owner's existing Tailscale demo. A native Docker/PostgreSQL run, Windows Compose/Tailscale demo rebuild and phone check must be run separately. They are not the 0.9.0 results.

Windows native acceptance was subsequently completed successfully. See [Windows acceptance 0.9.1](WINDOWS_ACCEPTANCE_0_9_1.md) for the executed results.

## Windows native acceptance after replacing the source

Back up your current source and database first; preserve the original private `.env.demo`, credentials, database volumes and Tailscale state outside any source ZIP. Do not overwrite them with archive contents. From the updated project directory, in PowerShell:

```powershell
docker compose up -d postgres
docker compose --profile test run --build --rm tests
Set-Location frontend
npm.cmd ci
npm.cmd exec -- playwright install chromium
npm.cmd run build
Set-Location ..
docker compose up -d --build backend frontend
# Set TEST_STAFF_PASSWORD in this PowerShell session to the existing local fixture password.
npm.cmd --prefix frontend run test:pilot
```

For the disposable private demo, follow `START_DEMO.md` and `docs/PRIVATE_DEMO.md` using the existing `.env.demo`; rebuild *only that named demo stack*. Run `npm.cmd --prefix frontend run test:demo` with `TEST_STAFF_PASSWORD` set locally for that demo, then inspect the updated walkthrough and simulated reservations on a phone using its tailnet URL. Keep Tailscale and Mailpit private. Reprint codes from the origin that guests will actually open; a QR printed on localhost will not work on another device.

Run the existing native outage/restore review against a disposable test stack and separately confirm the original demo and local volumes persist. No claim of a real merchant onboarding or payment certification follows from these checks.

## Remaining validation

- An explicit rollback/failure injection for the one-step starter and same-key replay under concurrency remain additional hardening. Native PostgreSQL V8/V9 and the full Java suite passed on Windows.
- On-device narrow and large phones, tablet, keyboard and screen-reader review, and Firefox/WebKit coverage.
- Isolated demo rebuild/test after copying; Tailscale desktop and phone access, Mailpit, recovery and role boundaries in the actual Windows installation.
- Interview-led reservation requirements: capacity, opening hours, no-shows, reminders, contact/consent and retention. Practice approval does not represent a reservation.
- Production host/domain, external email ownership checks, SMS deliverability and privacy/retention review before any public or real-customer use.
