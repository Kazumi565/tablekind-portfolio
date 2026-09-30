# Phase 9 checkpoint â€” Tablekind 0.9.0

Baseline: the saved 0.8.0 source ZIP, continuing the original uploaded project.
Authorized scope: local email verification/recovery, private-demo update and
simpler interfaces throughout the application. No repository mutation or remote
deployment has been performed.

## Implemented

- V7 customer email challenges/outbox and the single-platform-administrator guard.
  V1â€“V6 remain unchanged; no ledger/payment/POS money behavior was changed.
- Local-only Mailpit verification and password reset, expiring one-use codes,
  committed failed-attempt limits, encrypted queue, retries and token revocation.
- Mailpit added separately to local/demo Compose; desktop-only inboxes on 8025
  and 8026. Existing private Tailscale setup and secrets remain in place.
- Dedicated optional guest account page, focused role navigation, More menu,
  clearer management/platform views and shared mobile styling.
- Ten-step demo including separate manager/waiter views and account verification.
- No public admin registration; private provisioning and MFA remain required.
- Windows start/update and acceptance instructions in START_PHASE9.md and
  PHASE9_HANDOFF.md. Local email details are in PHASE9_EMAIL.md.

## Final checkpoint status

Implementation, available validation and clean source packaging are complete.
Java 21 compile/package and the frontend production build passed. The complete
supplementary backend suite recorded 140 tests: 135 passed, five explicit native
concurrency skips, zero failures/errors. All seven saved-request checks and all
seven operations helper checks passed.

All seven browser scenarios passed: email, accounts, payment/recovery, POS,
onboarding/security, operations and the ten-step demo. Actual local SMTP capture
was exercised with Mailpit. Desktop/phone layouts were reviewed. Authenticated
platform browser actions remain a private manual gate; its dashboard rendering
was checked separately with mocked API fixtures. See PHASE9_VALIDATION.md and the
sanitized result JSON files in docs/verification for scope and exact counts.

Browser review fixed an existing demo-config race that could replace a typed
login email and an earlier POS role check that hid manager controls from owners.
Mobile navigation no longer overlaps when labels exceed the available row.

Docker, native PostgreSQL execution and PowerShell are unavailable here. Actual
Windows/demo startup, Flyway/native concurrency, private phones, real outage and
backup restoration remain pending. PGlite results are supplementary only.

## User installation and next step

The user's SSD migration is complete, but their project is still Phase 7D and
GitHub is Phase 6. The current project path is:

`C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring`

Use docs/WINDOWS_UPDATE_AND_GIT.md. It preserves the Phase 7D source checkpoint,
private configuration, Git history and databases; copies the complete 0.9.0 ZIP;
runs native/browser/operations gates; then stages reviewed source and pushes an
update branch only when the user runs those commands. No intermediate ZIP is
required. No repository commit, push or merge was performed here.

No real email/SMS/payment/POS/fiscal service, domain, public hosting or reservation
feature is included. Continue from this 0.9.0 source, not an older snapshot.
The archive excludes private settings, secrets, dependency/build directories and
database dumps.

## Post-checkpoint Windows acceptance

The Windows native, browser, private-demo, outage and restoration gates were
completed on 22 September 2026. A private local platform administrator was also
provisioned and TOTP sign-in passed. See
[WINDOWS_ACCEPTANCE.md](WINDOWS_ACCEPTANCE.md) for the observed results,
installation boundary and remaining work. These later results supersede the
pending native-acceptance status recorded when this checkpoint was prepared.
