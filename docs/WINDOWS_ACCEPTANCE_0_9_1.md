# Windows acceptance — Tablekind 0.9.1

Date: 24 September 2026.

This record covers checks executed on the Windows development computer after
updating the existing Tablekind 0.9.0 working tree to 0.9.1. It contains no
credentials, access tokens, private network addresses or database dumps.

## Results

| Check | Observed result |
| --- | --- |
| Protected migrations | Existing Flyway V1–V7 remained unchanged |
| Native backend suite | 151 tests passed with zero failures, errors or skips |
| Frontend installation | npm audit reported zero vulnerabilities |
| Production frontend build | TypeScript and Vite build passed |
| Local database upgrade | PostgreSQL applied Flyway V8 and V9 successfully |
| Local services | Backend, frontend, PostgreSQL and Mailpit healthy |
| Local readiness | Reported UP |
| Local pre-upgrade backup | Restored in isolation with 46 tables and balanced financial records |
| Demo pre-upgrade backup | Restored in isolation with 46 tables and balanced financial records |
| Pilot browser scenario | Passed at six viewport widths with labels, focus, contrast, loading and duplicate-submit checks |
| Private-demo browser scenario | Passed all eleven steps, including local email and a simulated reservation |
| Private demo networking | Existing private Tailscale address remained accessible |
| Native outage review | Passed with nativeChaos enabled |
| Review workload | 500 reads with 20 concurrent clients and zero unexpected errors |
| Review latency | p50 250 ms, p95 390 ms and maximum 625 ms |
| Financial consistency | Zero unbalanced allocations and zero unbalanced settlements |
| Review restoration | 48 tables restored with exact source comparison |
| Failed migrations | Zero |

## Boundaries

The reservation workflow is a local/demo simulation. It does not hold capacity,
notify a restaurant or confirm a real booking.

Payments, MIA, terminals, fiscal systems and POS connections remain TEST
simulators or unconfigured. No real customer money was processed.

Mailpit remains local test email. No public domain, production email provider or
SMS provider is configured.

The browser checks do not replace a manual screen-reader review, multi-browser
coverage or restaurant validation. Production hosting, provider credentials and
a controlled pilot remain future work.
