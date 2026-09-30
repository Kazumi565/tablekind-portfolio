# Phase 7D validation — 0.7.1

Historical evidence for the supplied 0.7.1 baseline. It is not a test result for
0.7.2. See [RELIABILITY_VALIDATION.md](RELIABILITY_VALIDATION.md) for this update.

Recorded 18 September 2026 (UTC). This distinguishes observed checks from the native acceptance gate still to be run on the user's PC. The earlier Phase 7A–C local passes do not prove the new 7D changes.

## Observed in the supplementary environment

| Check | Result |
| --- | --- |
| Java 21 / Maven compilation and executable JAR | Passed for version 0.7.1 |
| Backend suite | 95 tests: 92 passed, 0 failures/errors, 3 native concurrency cases skipped |
| New backend cases | 8 passed: scoped/read-only status, role/tenant denial, aged pending hold preservation, paused connection status, safe probes, hardened configuration and redacted database error |
| Operational helper unit checks | 7 passed: cleanup boundaries, exact target, corruption rejection, overwrite refusal, binary dump preservation, local-only review URL, no credential-forwarding redirects |
| Payment browser regression | 14 checks passed |
| TEST POS browser regression | 9 checks passed |
| Onboarding/account-security browser regression | 6 checks passed |
| Private demo browser regression | 7 checks passed, including one-phone role switching and retained walkthrough state |
| Operations screen (local and demo profiles) | 4 checks each: clean fixture, stale-success removal after HTTP 503, recovery/mobile fit, pause/resume alert |
| Supplementary operational API run | 2 tables × 2 guests, 8 reads, 4 concurrent readers; exact balances, idempotent payment starts/replay, lost notification recovery, offline TEST POS catch-up passed |
| Frontend TypeScript / Vite build | Passed |
| npm audit / npm audit --omit=dev | 0 reported vulnerabilities at validation time |
| Changed frontend formatting | Passed |
| YAML parse / Python syntax | Passed; not a Docker Compose execution |
| V1–V4 preservation | All four migration files byte-for-byte identical to the supplied baseline archive |

The supplementary API run recorded p95 **54.81 ms** for only eight reads, with a deliberately loose 30-second supplementary budget. This is a harness check, not a capacity result. The default native test uses 500 reads and a 5-second budget. Do not present the supplementary figure as restaurant/production performance.

Evidence files are under `docs/verification/phase7d/`. Browser runs used real Chromium against the actual Spring Boot API and a supplementary PGlite database. Screenshots were checked for readable phone layout; no uncaught browser errors were reported. The operations HTTP 503 screen test injects an error response; it is not a real database outage.

## Limitations and required native gate

This environment does not have a working Docker daemon, native PostgreSQL 16, pg_dump/pg_restore or Windows PowerShell. Backend/browser runs used PostgreSQL-in-WASM (PGlite, reporting PostgreSQL 18.3), one connection, explicit application of V1–V5 and Flyway disabled. The three existing native concurrency tests deliberately remain skipped rather than pretending this backend reproduces native concurrent sessions.

Not executed here:

- Native PostgreSQL 16/Flyway migration and all 95 tests without skips.
- Docker build/Compose startup, abrupt container termination, real database stop/reconnect and readiness behavior during that outage.
- Default 20-client / 500-read native load and concurrent payment campaign.
- Real pg_dump binary backup, pg_restore, restored row-digest comparison or Windows subprocess execution. Binary streaming/checksum/target safety were unit-tested, but that is not a restored database.
- Restored application/MFA sign-in, off-host backups, sustained soak/fault testing, external alert delivery, cloud hosting or real providers.

Run `docker compose --profile test run --build --rm tests`, then `py -3 scripts/ops/review.py` as described in PHASE7D_HANDOFF.md. Keep its JSON evidence, the native backend reports and any failure output. A passing native review must say `nativeChaos: true`; an API-only pass does not satisfy this gate. Then run the browser scenarios and manually inspect the local and private demo.

Status: **implementation ready for native review; operational acceptance pending**. Neither this checkpoint nor a successful native smoke test authorizes processing real money or sending real kitchen orders.
