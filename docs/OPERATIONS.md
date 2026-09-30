# Operational reference

Applies to 0.7.2, local/private TEST installations. Real PSP/POS adapters, production hosting and a restaurant trial are separate work. Operational automation must never be pointed at an unknown or live restaurant system.

## What the status screen means

`GET /api/restaurants/{id}/operations` requires a current manager membership. It is read-only, restaurant-scoped and `Cache-Control: no-store`. No names, credentials or item details are returned. The manager screen refreshes every 30 seconds while mounted. A failed refresh removes stale healthy results.

| Signal | Threshold / meaning | Action |
| --- | --- | --- |
| POS failed | At least one exhausted/non-retryable message | Inspect original message and compare the tracked bill before retrying the SAME message |
| POS paused | Connection explicitly paused | Resume only when appropriate; queued work is retained |
| POS backlog | Oldest undelivered message at least 120 seconds old | Check queue and connection; do not send a new duplicate order |
| Payment pending | Pending for over 10 minutes | Query original provider attempt or verify staff collection; never infer failure from age |
| Refund pending | Pending for over 10 minutes | Reconcile original refund; never issue a second refund to resolve uncertainty |
| POS difference | Last saved comparison says MISMATCH | Let queue catch up and compare again; never edit ledger totals to hide the difference |
| Worker not ready | Local process disabled, starting, no successful tick for 30 seconds, or most recent tick failed | Inspect backend availability/logs; refresh after recovery |

Worker health describes this JVM, not a multi-instance fleet or an external kitchen. A RUNNING worker may still have failed deliveries, which appear separately. A saved POS comparison can be old; the screen does not automatically contact the POS. Status counts are nearby read-time snapshots, not a transactionally frozen accounting report. No alerts means none of these conditions was observed; it does not certify security, backups, provider connectivity or production readiness.

## Health and lightweight monitoring

- `/actuator/health/liveness`: JVM/application lifecycle only; a database outage must not cause a restart loop.
- `/actuator/health/readiness`: includes database reachability; HTTP 503 when unavailable.
- Health responses expose status only, not database/configuration details. Metrics/environment endpoints are not made public.
- Existing API authorization stays in place. Database connection acquisition is bounded to 3 seconds, JDBC connect to 3 seconds, socket reads to 20 seconds, SQL statements to 15 seconds. These are operation-level bounds, not a universal end-to-end SLA.
- Graceful Spring shutdown is 20 seconds per phase; Compose grants the backend 30 seconds. Backend container logs rotate at 10 MB × 3 files. PostgreSQL and other container log retention is not changed.

From a normal local installation with backend on port 8080:

```powershell
py -3 scripts\ops\monitor.py --url http://127.0.0.1:8080/actuator/health/readiness
py -3 scripts\ops\monitor.py --url http://127.0.0.1:8080/actuator/health/readiness --watch
```

One-shot mode exits 0 for UP/OK, 1 otherwise. Watch mode polls every 30 seconds, prints changes, and stops with Ctrl+C. The manager operations URL can also be monitored using an existing short-lived bearer in `TABLEKIND_MONITOR_TOKEN`; never paste tokens into source, command arguments, reports or Git. Session expiry/revocation yields UNAVAILABLE until reauthenticated. HTTP redirects are rejected so credentials cannot be forwarded to a different endpoint. Use HTTPS outside localhost. The private demo does not expose the backend health path through its frontend proxy; use its authenticated operations URL instead.

These are on-screen/terminal alerts only. No email, SMS, scheduled service or 24/7 external monitoring is configured. The PC must remain on for the local demo and these watchers to work.

## Bounded native review

`py -3 scripts/ops/review.py` creates unique `tablekind-ops-<12 hex>` and `tablekind-restore-<12 hex>` Compose projects, fresh credentials and databases. Native defaults: 5 tables, 4 guests each, one 100.01 MDL item per guest, 25 reads per guest, up to 20 concurrent readers, up to 8 concurrent payment starts, p95 read budget 5000 ms. Rate limits remain enabled. Revision conflicts are retried only when explicitly rejected as STALE_REVISION; replay of an uncertain accepted payment uses its original key and body.

The test simulates a successful provider outcome without its notification, kills/restarts only its own backend, stops/restarts only its own PostgreSQL container, checks liveness/readiness/API error behavior, recovers the original payment, drains the original POS queue, and checks exact internal/POS balances and kitchen-ticket count. It stops its backend for an exact source fingerprint, creates a custom-format dump, restores into another new PostgreSQL 16 database, then compares all public tables and financial invariants.

The workload is a bounded correctness/recovery smoke test. It is not a sustained load/soak test, WAN partition, disk-full simulation, provider certification, flood-resistance claim or sizing guarantee. P95 is for the read workload, not checkout. Tests use TEST providers and a single backend instance. Native three-way concurrency cases also remain in the backend suite. Run the defaults on your PC and record the actual results before deciding on a hosting size.

Options: `--tables 1..5`, `--guests 1..4`, `--reads 1..100`, `--port 5281`, `--p95-ms 5000`. `--api-only --url http://127.0.0.1:8080` is a supplementary mode that adds a new fictional restaurant to an explicitly supplied local TEST installation; it does not test Docker restart, real database outage or restore. Do not use Python's `-O` option: assertions are part of the verification.

Results go to ignored `test-results/operations/<run>/result.json`; review backups stay in ignored `backups/`. Cleanup only accepts randomly named operational/restore project patterns. It removes those disposable containers and volumes, not local/demo data. If interrupted forcefully, identify the exact project printed by the script before cleanup. Use `py -3 scripts/ops/cleanup.py --project <that-exact-project>`; it refuses local/demo project names. Do not use global Docker prune commands. Image layers/build cache are retained.

## Backup and restoration

`backup.py --stack local` and `--stack demo` use explicit existing Compose projects and verify the selected database. A successful `pg_dump` is streamed as binary directly to an exclusive `.partial` file, then finalized as `.dump` with adjacent SHA-256/size metadata. Existing files are not overwritten. A failed partial is not a backup and is left for diagnosis. No service is stopped by the backup command. A live PostgreSQL dump uses a consistent snapshot, but separate config/provider state is not included.

`restore_check.py --backup <dump>` verifies its manifest before creating resources, then restores schema/data/triggers in a single transaction to a NEW database. It checks migration success, item allocations and payment/refund settlement totals. Ordinary backup verification does not compare every row with a moving live source; exact row comparison occurs in the controlled review with its source stopped. A successful `.restore.json` records the tested checksum. This is not automatic disaster-recovery cutover, and no working database is overwritten. Trust the origin of the dump: a matching hash detects damage, not malicious SQL.

Keep dumps and manifests private. They contain customer/account data, hashes and encrypted MFA seeds. They are not encrypted by these scripts. Use protected/encrypted storage and a second copy outside the computer; a same-disk backup is insufficient. Preserve the corresponding original JWT/signing secret separately: it also protects MFA seeds and reusable QR links in this version. Do not generate a replacement secret when restoring. Credentials, `.env.demo`, tailscale state and backups must not enter Git or the shared source ZIP.

Before a real deployment, agree a backup schedule/retention, off-host encryption, recovery point/time targets and named responder. Run a drill on a separate application+database with the matching secrets and verify manager/MFA sign-in, existing orders, payment reconciliation and provider state before any live cutover. Current scripts prove database restoration only; they do not prove those external dependencies. Never blindly restore yesterday's database and retry today's payments: first reconcile newer provider activity to avoid duplicate charges/orders.

## Incident checklist

1. Stop initiating new affected transactions. Keep the page and original pending request; do not force-clear a payment hold because a timer expired.
2. Read readiness and manager status. In local development, inspect `docker compose ps` and `docker compose logs --tail 100 backend postgres`. Do not post raw logs without checking for private data.
3. Database offline: preserve its volume, recover the database, then let the existing backend reconnect. Do not repeatedly restart the backend because liveness is healthy while readiness is down.
4. Uncertain payment/refund: reconcile the original attempt through the provider control. A browser success page is not settlement proof. Cash/terminal collection needs staff confirmation and evidence; do not collect again automatically.
5. POS backlog: check its pause/connection state. Restore service and allow retries of the original message; investigate exhausted messages and reconcile after delivery. Do not recreate orders in two systems without a staff-controlled reconciliation plan.
6. Actual data loss: stop writers, preserve what remains, validate the last trusted backup in isolation, involve the responsible operator, and reconcile provider-side activity before a controlled restore/cutover. The supplied tool deliberately does not overwrite live data.

## Opt-in hardened configuration

`application-hardened.yml` is a configuration guard/template, NOT a production deployment. It requires explicit `JWT_SECRET` (at least 48 UTF-8 bytes), `DB_URL`, `DB_USER` and `DB_PASSWORD`; rejects the known local examples and `local`/`demo` profile combination; disables API documentation. The length check does not prove random entropy. Generate independent strong secrets for a new installation, and preserve existing secrets for migrated data. TEST provider/bootstrap components do not run under this profile; no real provider is magically enabled. Do not select it to run the existing phone demo.

TLS/domain/secret management, database/network permissions, provisioned initial identities, live adapters, external monitoring and deployment review still need a separate hosting decision. No public ports, DNS, cloud services or external notifications were configured by this update.

The hardened/unconfigured profile rejects all payment and refund mutations,
including cash/terminal records and cached payment-command replay. Existing
history remains readable. This is an explicit practice-only release boundary,
not an enabled merchant configuration.

References: [Spring Boot health groups](https://docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html), [PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html), [PostgreSQL 16 pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).
