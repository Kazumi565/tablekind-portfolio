# Tablekind 0.9.1 — technical evidence for a practice pilot

## Architecture in one page

Mobile React/TypeScript serves four entry areas: guest, waiter, restaurant management and a separate platform operator. A Java 21/Spring Boot API checks bearer identity and live membership for each privileged call. PostgreSQL holds scoped restaurant, table, menu, order and integer-bani bill records; Flyway manages schema versions V1–V9. A practice-only provider and POS worker exercise idempotent flows. Mailpit captures local account email. The isolated Docker/Tailscale demo has its own database and does not expose a production payment processor. A manager may start a new fictional practice scenario; earlier settled scenarios remain intact.

## Identity and isolation

| Area | Allowed actions | Boundary |
| --- | --- | --- |
| Guest | QR join, own table orders/shares/TEST checkout, optional customer profile and own practice reservation | Cannot open staff/manager/platform routes; optional account cannot resume another account's guest |
| Waiter | Own restaurant service, order approval, cash confirmation, item availability | Cannot change policies, onboarding, users, pilot report or practice reservation decisions |
| Manager / owner | Their restaurant setup, staffed access, printed codes, practice reservation review and aggregate pilot report | Manager cannot act in a different restaurant; manager cannot appoint a manager or transfer ownership without owner role |
| Platform operator | Provisioning and platform review with separate MFA | Only one operator row; no public registration or implicit restaurant membership |

All financial values remain integer bani, ledgers retain accounting checks, and mutation receipts preserve idempotency. The starter operation creates one branch, enabled table, menu category, priced product and signed printable table code in one transaction for a *fresh* restaurant. Privileged access is checked before replaying its receipt. Existing Flyway V1–V7 are untouched.

## Practice metrics and limits

`V8` stores only `(restaurant_id, UTC day, event, count)` for successful table-link views, table joins, order item submissions, share votes approved/declined, successful TEST payments, closed positive-bill practice tables and scoped API errors. Counts from audit events commit with the underlying event, so idempotent replay does not add another join/order/payment. The manager-only 30-day screen supplies daily counts and totals. An unmatched scan or join is an **estimate** from aggregate totals, never a tracked person or verified abandonment; reloads, older cohorts and orders per person affect it. Database-outage errors cannot be written while the database is offline. Events before migration are not backfilled. Existing operational audit records still have their separate retention/privacy obligations; new guest-join audit details omit the guest nickname.

`V9` provides practice reservation requests from an already joined guest. A manager can practice approve or decline, a guest can cancel, and requests are scoped to a restaurant/branch and requesting guest. There is **no table capacity hold, real confirmation, notification, public reservation page or integration with a restaurant calendar**. Requests use the existing guest record, not a new phone number or contact database. The API is enabled only for local/demo profiles.

Suggested first-pilot evidence: observe fictional groups completing joins/orders/splits/payments, record support issues and staff time separately, compare group-level feedback with daily aggregate trends, and check zero duplicate settlements or accounting differences. Establish any numerical adoption target with the restaurant before a live pilot. Do not interpret scans as unique diners or completed TEST payments as revenue.

## MAIB comparison

MAIB's published *Împarte plata* description says a maibank user can split a previously paid or manually entered expense, request participants' shares and track their responses. Tablekind's practice workflow instead coordinates item allocations, guest consent, waiter approval and individual settlement *during* a table session. This is a product workflow comparison, not a claim of unique IP or superior market adoption. Tablekind cannot process a real MAIB payment today. Source: [MAIB announcement, 11 September 2026](https://www.maib.md/ro/noutati/maib-lanseaza-imparte-plata-o-noua-functionalitate-pentru-gestionarea-mai-simpla-a-cheltuielilor-comune).

## Evidence status and unresolved work

The 0.9.0 Windows/PostgreSQL acceptance and private-demo checks recorded in `docs/WINDOWS_ACCEPTANCE.md` belong to **the previous build**. See `docs/PHASE9_1_VALIDATION.md` for this update's own executed and pending tests. The supplied source has no real bank, MIA, terminal, fiscal or POS integration. It has no public host, purchased domain, real email provider, SMS gateway, restaurant interview or live restaurant validation. Staff passwords still require careful private handoff, and backups/config must remain off Git. No cash or card action in this practice release may collect real customer funds.
