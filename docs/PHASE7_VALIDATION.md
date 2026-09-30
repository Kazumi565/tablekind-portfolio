# Phase 7A–C validation

Version 0.7.0, 18 September 2026. This records checks performed on the Spring Boot and React implementation. Payment and POS providers remain simulated. Phase 7D is deferred.

## Observed results

| Check | Result |
| --- | --- |
| Backend suite | 87 tests: 84 passed, zero failures/errors, three native concurrency cases skipped |
| Final account-security regression | 12 targeted tests passed after the recovery-code generation update |
| Existing ordering/payment browser scenario | 14 checks passed |
| TEST POS browser scenario | Nine checks passed |
| New onboarding/security browser scenario | Six grouped checks passed, including the guest's exact personal balance |
| Private-demo browser scenario | Seven checks passed using the demo Spring profile |
| TypeScript and Vite production build | Passed with Vite 8.3.0 |
| Java 21 compilation and executable JAR packaging | Passed, version 0.7.0 |
| npm audit, including development dependencies | Zero reported vulnerabilities at validation time |
| npm audit --omit=dev | Zero reported vulnerabilities at validation time |
| SQL migrations | V1–V4 applied directly in the supplementary database; V1–V3 unchanged from the saved baseline |
| Printed QR | One-page PDF contains only the restaurant/table card; staff controls are absent |
| Screens | Phone and desktop screenshots inspected; tested pages fit the viewport without horizontal overflow |
| Native PostgreSQL 16/Flyway/Docker/Tailscale/physical phone | Not executed in this environment; local verification remains required |

## What was exercised

The existing tests retain order ownership, split consent and exact rounding, idempotent retries, payment reservations, mixed cash/card settlement, refunds, reconciliation and POS queue recovery.

Phase 7 backend tests add:

- RFC 6238 known vectors and account-bound encryption authentication.
- MFA setup, expiry, enrollment, code replay rejection, single-use recovery, disablement, password changes and token revocation.
- Persistent rate-limit rejection and window reset.
- Current staff membership, cross-restaurant isolation, manager-only settings and demoted-manager receipt replay denial.
- Printed link generation/rotation, disabled and closed tables, invalid signatures, expiry, session binding and revoked-guest join retry.
- Server-side pay-at-table restrictions, valid language policies, onboarding evidence and restricted audit access.

The Phase 7 browser test creates a restaurant, branch, table, bilingual menu item and waiter account through normal forms. It generates and prints a table QR, rejects a join while closed, opens the table, joins a guest, verifies the configured menu language, enters/accepts food as staff and checks the guest's 45.00 MDL balance. It also checks hidden manager tools, phone MFA enrollment/recovery sign-in, HTTP 429 with Retry-After, and uncaught browser errors.

The demo test uses its separate profile and practice controller. It verifies a lost scenario-creation response, role switching on one phone, consenting to a shared item, exact TEST card/cash collection, TEST POS reconciliation, starting again without erasing the settled table and clearing demo roles on sign-out. It does not test the Tailscale network or the container proxy.

## Supplementary environment and remaining native gate

Checks used Java 21, Node 24, Chromium and PGlite through the PostgreSQL JDBC driver. V1–V4 were loaded directly; Flyway was disabled and the connection pool restricted to one connection. PGlite and the local runtime helpers are not application dependencies and are not shipped.

This gives useful SQL, HTTP, security, ledger and browser regression evidence. It does not establish native PostgreSQL locking/concurrency, Flyway startup/upgrade behavior, Docker persistence, Tailscale access, external-provider compatibility, accessibility across all devices or production performance.

The three skipped cases are concurrent checkout reservations, concurrent payment attempts and concurrent POS worker claims. They must run on native PostgreSQL. Before updating the working app, follow the backup instructions in [PHASE7_HANDOFF.md](PHASE7_HANDOFF.md), then run:

```powershell
docker compose --profile test run --build --rm tests
```

Expected: 87 tests, zero failures, errors or skips. Review any failure before proceeding. Also verify the migrated app and the rebuilt private demo on the user's actual phone. Load/outage campaigns, backup restoration drills, operational monitoring and a live restaurant trial remain Phase 7D or later work.

## Evidence

`docs/verification/phase7/` contains sanitized backend results, browser results, dependency audit summaries and screenshots. Earlier verification directories are historical. No test passwords, authenticator seeds, recovery codes, bearer tokens or raw server logs are included in the new verification records.

Menu translations remain configurable in Romanian, Russian and English; the interface itself is English. The checklist records setup data and practice events. Creating a QR does not prove it was physically printed, and connecting TEST POS does not certify a real kitchen connection. See [PHASE7_SECURITY.md](PHASE7_SECURITY.md) for QR-presence and key-rotation limitations.
