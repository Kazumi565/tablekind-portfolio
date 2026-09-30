# Tablekind 0.9.1 — practice pilot architecture

**Purpose.** Guests join a table by QR, order, agree on shared items and coordinate exact individual TEST settlements. Staff serve that table, managers configure their own restaurant, and the single provisioned platform operator manages restaurant onboarding.

| Layer | Responsibility |
| --- | --- |
| React/TypeScript | Four role-specific entry areas, guest ordering and payment coordination, manager setup and practice reservation review. Mobile layouts share one API. |
| Java 21 / Spring Boot | Bearer sessions, live role and restaurant membership checks, transactional order/share/payment commands, audit and aggregate pilot reporting. |
| PostgreSQL / Flyway | Restaurant-scoped operational data, integer-bani allocations and payment records, idempotency receipts; additive V8 pilot counts and V9 practice reservation schema. |
| Isolated demo | Separate Docker database, Tailscale access, Mailpit email capture, TEST card/cash and POS simulators. Restarting a practice scenario keeps settled records. |

**Financial integrity.** Guests see their own exact obligations. Sharing needs explicit acceptance. Idempotency receipts prevent repeated requests from creating extra commands. Tests cover role boundaries, scoped records and balances; native PostgreSQL 16 verification of this update is still required.

**Isolation and privacy.** Guests cannot perform waiter or management actions, waiters cannot alter manager settings, and managers cannot operate another restaurant. Platform administration has no public signup. Optional accounts cannot access another customer's information. New pilot measurements store only restaurant, UTC date, event type and count. They do not identify a visitor or prove unique scans or abandonment. Practice reservations require an existing table guest and have no contact fields or capacity allocation.

**Evidence and limits.** See [validation](PHASE9_1_VALIDATION.md) for executed tests and Windows steps and [pilot evidence](PILOT_EVIDENCE.md) for the MAIB comparison and candidate pilot metrics. There is no public hosting, purchased domain, production email/SMS, live restaurant pilot, real POS, fiscal, bank, MIA or terminal integration. No real money can be handled by this version.
