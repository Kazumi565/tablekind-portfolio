# Phase 6A: POS framework

## Included

- `PosConnector` separates catalog retrieval, bill retrieval and idempotent delivery from the domain services.
- A persistent TEST POS implements the contract in the local and demo profiles. Other profiles do not register this adapter.
- One account per restaurant, covering its shared catalog and table mappings. Separate POS accounts for individual branches are not supported yet.
- Catalog import covers categories, translated products, allergens, dietary labels, prices, availability and modifier groups/options. External-to-local IDs remain stable. Missing products become unavailable rather than being deleted.
- Only sessions opened after connection are tracked. Connecting requires all existing sessions to be closed. No historical kitchen orders are replayed.
- Table changes capture accepted items, charge adjustments/cancellations, confirmed payments, tips, confirmed refunds and session closure into a durable outbox in the same transaction.
- A background worker delivers ordered bill projections. This is at-least-once transport with idempotent simulator effects, not a promise of universal exactly-once execution.
- Staff see pending/failed queue counts in their table view. The POS dashboard, bill comparisons, failure inspection, pause/resume, retry, imports and test controls require a manager.

## Transaction and delivery contract

`Sessions.event` runs inside the existing business command transaction. It increments the session revision, writes an audit event, and captures the changed POS projection. Identical projections are not re-enqueued: joining a table or reallocating unchanged charges does not create another kitchen order.

`PosDelivery.claim` uses a short transaction and `FOR UPDATE SKIP LOCKED` to claim the earliest undelivered message for each session. Later messages cannot overtake an uncertain or failed message. A blocked table does not block other tables.

The claim commits before `PosConnector.apply` executes. No network work belongs inside the customer order transaction or its session lock. Delivery acknowledgment is a separate transaction. See [PostgreSQL's locking documentation](https://www.postgresql.org/docs/current/sql-select.html) and [Spring transaction semantics](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html).

Messages have immutable IDs, payloads, fingerprints and revisions. The connector must return the matching command, restaurant, session, revision, fingerprint and external bill reference. A mismatch cannot mark delivery successful. A 45-second lease token fences late acknowledgments. An abandoned lease retries the same command identity. Eight automatic attempts per retry cycle are permitted, with delays beginning at 2 seconds and doubling. Manual retry resets the cycle while retaining the lifetime attempt count.

A receipt means the adapter acknowledged this projection. It does not mean a bank settled funds, a kitchen cooked food, or a fiscal receipt was issued. The worker does not collect money; it writes back already-confirmed local tenders.

## Real-adapter requirements

The projection contains stable item/payment/refund/charge IDs, external product/option/table references, snapshots of ordered choices, and integer MDL amounts. A real adapter must translate projection differences into the POS's own API operations. It must not repeatedly create every item in the snapshot.

Before any real adapter is enabled:

1. Obtain the exact POS product/version, API contract, restaurant account, sandbox and required approvals.
2. Implement account-scoped identifier mapping and confirm partial/mixed tender, refunds, adjustments and the required fiscal workflow are supported.
3. Persist progress for multi-operation commands. Use stable per-operation keys derived from command/item/payment/refund IDs, and authoritative lookup when a reply is lost. If the POS cannot safely deduplicate or determine an uncertain outcome, stop for manual review instead of blindly retrying.
4. Enforce bounded network timeouts shorter than the lease, for example a 10-second request timeout. Translate only known retryable errors to automatic retry. Never display raw provider responses, credentials or customer data as queue errors.
5. Validate merchant identity, MDL currency, amounts, references and external bill state. Refuse unsupported tax/discount/refund semantics rather than approximating them.
6. Define POS-side edit/conflict handling. The simulator accepts the projection, but a real POS is authoritative for its operational/fiscal state. Do not overwrite unrelated waiter-entered orders.
7. Implement provider-specific hosted payment checkout, signatures, lookup and settlement reporting separately. The Phase 5 test HMAC contract is not a real provider protocol.
8. Test interruption, restart, duplicate messages, reconciliation, refunds and fiscal receipts in the provider/POS sandbox before a controlled restaurant trial.

No real POS name, endpoint, bank transaction ID or receipt number has been invented. `TEST-*` references belong only to the simulator.

## Catalog and kitchen synchronization

Catalog/kitchen reads occur outside write transactions. Validated imports commit atomically. Completed import commands retain their idempotency response, including recovery when the original import succeeded and the POS subsequently became unavailable.

Catalog revisions cannot go backward or reuse a version with different content. Unchanged source products retain their local version. Changed products bump their version, so a stale submitted order cannot be accepted at a silently changed price. Accepted items retain their historical snapshots. Direct editing of products, categories, options and availability is disabled while connected.

Imports are explicit manager actions in Phase 6A. Scheduled catalog polling and authenticated POS webhook adapters are not implemented. Kitchen imports support forward progress through ACCEPTED, PREPARING, READY and SERVED. Old statuses never move an item backward. Kitchen cancellation/rejection does not silently alter financial state.

## Reconciliation

Reconciliation compares current local bill lines/charges, tenders, refunds, tips, session state, external references and delivered revision with a fetched POS snapshot:

- MATCH: compared records agree and no delivery is outstanding.
- PENDING: undelivered messages exist; differences may be due to synchronization delay.
- MISMATCH: no queued work explains the disagreement. Staff must investigate.

Reports are timestamped snapshots, not continuous guarantees. The UI marks a result stale after a newer local projection is queued. The comparison never changes payments or rewrites the bill. A new remote edit can only be detected on the next comparison. MATCH does not prove bank payout or fiscal compliance.

The normal staff table view shows pending/failed POS updates. Local session closure does not discard queued messages or mean the external bill is closed. Confirm external state before treating it as operationally complete.

## TEST POS failure modes

| Mode | Behavior |
| --- | --- |
| ONLINE | Applies each command identity once and returns a durable receipt |
| OFFLINE | Reads and deliveries fail; outbox retains work with backoff |
| LOSE_REPLY | Commits the next new command and receipt, then drops the reply; retry returns the saved receipt |
| REJECT | Rejects new commands until a manager restores service and retries |

The simulator uses separate database tables and a separate committed transaction, but still shares the application's process/database. It proves specific recovery paths, not actual network, vendor, fiscal or hardware behavior.

Pausing does not erase messages and cannot retract an in-flight request. Never re-enter an uncertain order in another system until staff have checked whether it arrived. There is no "pretend delivered" button or destructive queue-clear action.

## API

All paths begin `/api/restaurants/{rid}/pos`. Existing bearer access and membership checks apply. Mutations need Idempotency-Key; reconciliation is an observational repeatable POST.

| Path | Method | Access / purpose |
| --- | --- | --- |
| / | GET | Manager: connection, counts, latest 100 messages and 50 tracked sessions |
| /connect-test | POST | Manager, local/demo profiles: create simulator and mappings |
| /pause | POST | Manager: pause/resume dispatch |
| /messages/{id}/retry | POST | Manager: retry FAILED/RETRY with unchanged identity |
| /catalog/import | POST | Manager: import source catalog |
| /sessions/{sid}/reconcile | POST | Manager: comparison that never changes financial state |
| /sessions/{sid}/kitchen/import | POST | Manager: import forward kitchen states |
| /mock/mode | POST | Manager, local/demo profiles: change failure mode |
| /mock/products/{pid} | POST | Manager, local/demo profiles: change source price/availability |
| /mock/sessions/{sid} | POST | Manager, local/demo profiles: change source kitchen state/test discrepancy |

Manager checks run before cached replay; demoted staff cannot replay a privileged operation. Guests cannot read or mutate POS state. Tenant-qualified lookups and foreign keys prevent cross-restaurant command access.

## Remaining scope

Phase 6B needs one restaurant, its exact POS, vendor API access and a licensed payment-provider sandbox. Importing bills created entirely outside Tablekind, multi-POS branches, scheduled inbound sync, real fiscal receipts and real online payments are not complete. Phase 7 account controls, onboarding and operational tools are implemented, with native Phase 7D verification pending. Hosting remains a separate decision.
