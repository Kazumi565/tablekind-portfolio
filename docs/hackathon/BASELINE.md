# Baseline and hackathon work

Author: Mihai Bargan. Solo portfolio entry. Work recorded on 11 October 2026.

The original portfolio baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935`, preserved by local tag `portfolio-before-paypal-ai`. Hackathon development is on `hackathon/paypal-bill-splitting`. No history was rewritten. Mihai later published the source branch manually; the assistant has not pushed, merged remote branches or published releases.

| Already in the baseline | Added for this entry |
| --- | --- |
| Java/Spring/PostgreSQL and React/TypeScript application | Isolated hackathon Compose project, profile and EUR fixture |
| MDL ordering, immutable accepted prices, integer ledger | Immutable restaurant currency and EUR throughout this scenario |
| Manual allocations, affected-diner votes, rejection/withdrawal | Hosted schema-constrained split interpretation and reviewed atomic proposals |
| Checkout reservations, command receipts, payment settlement constraints | Durable PayPal Orders v2 sandbox create, hosted approval, capture and reconciliation |
| Local card/MIA/cash/terminal simulators, TEST refunds | Provider-specific controls; PayPal cannot use simulator resolution or refunds |
| POS outbox and simulated restaurant integrations | Currency-correct snapshots; no new live POS integration |
| Mobile guest interface and two-person practice guide | Three-person EUR journey with AI preview and PayPal checkout |
| Existing portfolio tests, operations and presentation website | Payment/AI regression cases, browser checks and submission preparation |

The existing 151 backend tests passed before implementation. Frontend build, 7 recovery tests, 4 QR tests, 6 source-review tests and 7 operations-tool tests also passed. A pre-existing npm advisory affecting `source-map-js` 1.2.1 was fixed by updating the lockfile to 1.2.2; the current frontend audit reports no vulnerabilities.

The separate presentation website and existing MDL values were retained. The legacy column suffix `_bani` remains for compatibility: it means integer minor units in the restaurant's immutable currency, including euro cents for EUR. There is no exchange-rate conversion.

To inspect the original portfolio without touching the new database, use a separate checkout at the baseline commit and the original README's Compose instructions. Never start old application code against a database migrated by the hackathon branch.

Compare the work with `git diff portfolio-before-paypal-ai...hackathon/paypal-bill-splitting`. Attribution describes actual reused work; the hackathon organizers determine whether an update qualifies as significant.
