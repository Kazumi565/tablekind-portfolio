# Windows acceptance — Tablekind 0.9.0

Date: 22 September 2026.

This record covers checks actually completed on the user's Windows development
computer after applying Tablekind 0.9.0 to the existing Git working tree. It
contains no credentials, authenticator material, private network addresses,
database dumps or access tokens.

## Results

| Check | Observed result |
| --- | --- |
| Native backend suite | 140 tests passed with zero failures, errors or skips |
| Database runtime | PostgreSQL 16.15 with Flyway migrations V1–V7 applied successfully |
| Local Compose stack | Backend, frontend, PostgreSQL and Mailpit started healthy |
| Operations helper suite | 7 tests passed |
| Frontend installation | npm completed with zero reported vulnerabilities |
| Production frontend build | Passed |
| Saved-command recovery suite | 7 checks passed |
| Local email browser scenario | Passed using actual local SMTP delivery to Mailpit |
| Four-interface and optional-account scenario | Passed |
| Payment and recovery browser regression | Passed |
| TEST POS browser regression | Passed |
| Onboarding and security regression | Passed, including HTTP 429 throttling |
| Operations browser regression | Passed |
| Private-demo browser scenario | Passed all eight reported check groups |
| Native outage review | Passed with `nativeChaos: true` |
| Review workload | 500 reads, 20 concurrent clients, zero unexpected errors |
| Review latency | p50 218 ms, p95 312 ms, maximum 438 ms against a 5-second p95 budget |
| Financial consistency | Zero unbalanced allocations and zero unbalanced settlements |
| Exact review restoration | 46 tables restored with exact source comparison |
| Local backup restoration | 46 tables restored in isolation with all financial checks passing |
| Private demo | Five containers healthy; local and permitted Tailscale access passed |
| Platform administrator | One private local administrator provisioned; mandatory TOTP sign-in passed |
| Final backups | Fresh local and demo database backups created after provisioning |

The native outage review terminated and restarted only disposable backend and
database containers. It verified reservation preservation, readiness behavior,
payment reconciliation, TEST POS recovery, binary backup and isolated restore.
The ordinary local and private-demo databases were not replaced by that review.

## Important installation boundary

The previous Docker database volume was not present after the SSD migration.
Consequently, this run validated fresh V1–V7 databases and the updated source,
but it did not prove migration of the user's former populated Phase 7D database.
The earlier source tree was preserved separately before applying the update.

The standalone local restore reported `exactSourceComparison: false` because
that command validates the restored database without retaining a live source for
row-by-row comparison. The disposable native operations review separately
completed an exact 46-table source comparison successfully.

## Remaining boundaries

- Payments, MIA, terminals, POS and fiscal connections remain TEST simulators or
  unconfigured.
- Mailpit provides local captured email only. No real email domain, delivery
  service or SMS provider is configured.
- No public hosting or restaurant deployment was performed.
- Restored administrator/MFA sign-in with the matching signing secret was not
  manually exercised against a separately running restored application.
- Sustained capacity testing, external monitoring, off-device backup policy,
  deployment security review and a controlled restaurant pilot remain future
  work.
- Reservations are not implemented in this release.

This acceptance does not authorize real customer money, real kitchen delivery or
production restaurant use.
