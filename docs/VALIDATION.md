# Phase 6 validation record (historical)

For version 0.7.1, use [PHASE7D_VALIDATION.md](PHASE7D_VALIDATION.md) and [PHASE7D_HANDOFF.md](PHASE7D_HANDOFF.md). Counts, screenshots and commands below describe the earlier Phase 6 build.

Version 0.6.0, 16 September 2026. Phase 6A is a TEST-POS integration checkpoint, not a real-provider launch.

| Check | Observed result |
| --- | --- |
| Backend suite | 72 tests: 69 passed, no failures/errors, 3 skipped |
| Existing payment browser scenario | 14 checks passed, no uncaught JavaScript errors |
| New POS browser scenario | 9 checks passed, no uncaught JavaScript errors |
| TypeScript/Vite production build | Passed, Vite 8.3.0 |
| npm audit / npm audit --omit=dev | Both report zero vulnerabilities at validation time |
| Java 21 compilation and executable JAR | Passed |
| Exact V1, V2 and V3 SQL | Applied successfully in the supplementary database |
| V1/V2 preservation | Both byte-for-byte identical to the source archive |
| New Docker/Flyway/PostgreSQL 16 execution | Not executed here; requires the user's native test run |

The earlier native Phase 5 result and browser checks are a baseline, not proof of the new V3 migration or POS concurrency behavior.

## Supplementary environment

Backend and browser checks used Java 21, Node 24.19.0, the PostgreSQL JDBC driver and PGlite 0.5.8 (PostgreSQL 18.3 WebAssembly). V1/V2/V3 were loaded directly, Flyway was disabled, and the connection pool was restricted to one connection. PGlite is not a dependency of the delivered application.

This checks calculations, SQL constraints, HTTP behavior, durable state transitions and frontend integration. It does not establish native PostgreSQL 16 concurrency, Flyway lifecycle, container startup/restart persistence, real-provider behavior or restaurant-scale performance.

Three tests explicitly skip only in this supplementary environment:

- Concurrent phase 4 checkout reservations for the same remainder.
- Concurrent phase 5 attempts for the same remaining shares.
- Concurrent phase 6 worker claims and per-session ordering.

The default test path requires native PostgreSQL through Testcontainers or the dedicated Compose test database. It does not silently fall back when Docker is unavailable.

## Native gate

Follow the backup and update instructions in [PHASE6_HANDOFF.md](PHASE6_HANDOFF.md). Before migrating the application's database:

```sh
docker compose --profile test run --build --rm tests
```

Expect 72 tests with no failures, errors or skips. This uses a separate test database. Then start the app to verify Flyway validates V1/V2 and applies V3 without losing existing restaurant data. Finally, complete the offline-queue Docker restart check in the handoff. Keep both source and database backups.

## Coverage

Existing tests retain authentication, tenant isolation, QR/caps, menu/version checks, ordering, consent, sharing modes, transfer/takeover, adjustments, holds/expiry, assistance, idempotency and append-only accounting.

The retained payment tests cover:

- Card/MIA success, failure, cancellation and provider expiry.
- Bill/tip separation and mixed cash/terminal/online partial payments.
- Cash collection authority, received cash/change and required terminal reference.
- Payment-start idempotency and conflicting request reuse.
- Missing notifications, expired internal clocks and duplicate-collection prevention.
- Cancellation after an unseen provider success.
- Signed webhook verification, stale timestamps, duplicate IDs, altered payloads and out-of-order notifications.
- Merchant/currency/amount mismatches and payer access.
- Paying for others while preserving item ownership.
- Exact shared-item refund attribution, pending refund limits, failed refund retry, tip-only refunds and manager authority.
- Charge-reducing refunds versus payment-return refunds.
- Closing a settled/served table and refunding a closed session.

The 25 POS tests cover:

- Explicit connection setup, no open-table attachment and no historical replay.
- Unconfigured restaurants retaining their normal workflow.
- Stable external identifiers, exact accepted-order snapshots and kitchen-ticket deduplication.
- Lost replies, provider-side deduplication, offline recovery and ordered cancellation.
- Permanent rejection, bounded retries, pause/resume and manager retry of the same message.
- Worker crash after remote commit, expired leases, stale-worker fencing and exhausted abandoned claims.
- Provider acknowledgment identity checks and immutable outbox commands.
- Business-transaction rollback leaving no orphaned POS work.
- Mixed cash/card/tips/refunds, closed-table reconciliation and discrepancy visibility without rewriting the ledger.
- Catalog price/availability/modifier imports, unchanged mappings, missing products and malformed-import rollback.
- Historical food prices remaining fixed and stale menu acceptance being rejected.
- Forward-only kitchen status imports.
- Tenant, guest and manager authorization, including replay after a manager is demoted.
- Successful import replay while the remote provider is offline.
- One failed table not blocking delivery for another.
- Native concurrent-worker claims (the one POS test skipped in the supplementary run).

The existing 14-check browser scenario exercises real Spring Boot API calls from independent staff/guest contexts, live updates, consent, payment locks, reload, dropped-response retry, delayed provider confirmation, cash/tip/change, manager refund, reconciliation, test confirmations, responsive screens and setup forms.

The new nine-check POS browser scenario exercises manager setup, accepted-order delivery, exact comparison, a one-ban discrepancy without ledger mutation, kitchen import, catalog import without historical repricing, pause/resume, lost payment-write-back reply recovery, responsive screens and uncaught-error detection.

## Evidence and boundaries

- `docs/verification/backend-results.json`: sanitized final Surefire results, including the three skips.
- `docs/verification/browser-results.json`: existing browser scenario results.
- `docs/verification/pos-browser-results.json`: new POS browser scenario results.
- Screenshots in `docs/verification`: fictional customer/staff screens and POS desktop/mobile views.

The runtime JAR path is 0.6.0. V1/V2 remain unchanged. Source packaging excludes dependencies, build output, local environment files, test caches and Git metadata.

All external payment/POS behavior in this checkpoint is simulated and labelled TEST. No real merchant, fiscal receipt, production deployment, live provider compatibility or performance claim is established by these results. Native tests, restoration/restart verification and real connector certification remain separate gates.
