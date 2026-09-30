# Architecture

Tablekind is a modular Spring Boot monolith. PostgreSQL holds authoritative restaurant, order and financial state. React holds drafts and per-tab bearer tokens, then reads server snapshots. Authenticated SSE and periodic refresh update those snapshots.

Spring Data JPA manages the restaurant registry. Parameter-bound JDBC expresses financial operations explicitly. They share a datasource and Spring transaction manager. Flyway owns the schema.

## Phase 8 identities and interfaces

Version 0.8.0 adds V6 and four frontend entry areas: `/admin`, `/manage`, `/staff`
and `/guest`. They share the existing deployment; the platform interface is
loaded separately and has its own identity table, token kind and audit log.
OWNER is a restaurant membership on an individual staff identity. Its authority
does not extend to another restaurant or to the platform.

Optional CUSTOMER identities keep preferences and explicitly linked visit
summaries. They cannot call table APIs directly. A link requires both the customer
and an existing GUEST credential. Resuming issues a fresh GUEST credential for
the same guest, preserving financial ownership and command actor scope. Current
guest activity, account version and table status are checked. No ledger records
are changed by linking/resuming. The account row, session/guest locks and a unique
customer/session index prevent double claims. See PHASE8_ACCOUNTS.md for details.

## Operational boundary (7D)

Manager-only `/api/restaurants/{id}/operations` reads scoped queue/payment/refund counters and the local POS worker heartbeat. It never settles, cancels or repairs financial state. Liveness excludes the database; readiness includes it. API database interruptions return a generic 503, with retry advice that preserves original request identity. No extra public metrics or secret/config endpoints are exposed.

The optional hardened profile requires explicit credentials and excludes TEST profiles; it is not a live provider or a deployment. Operational review and restore use new isolated Compose projects, not working local/demo databases. Backup tools preserve binary PostgreSQL dumps and checksums; restoration checks cannot establish provider-side truth. See [OPERATIONS.md](OPERATIONS.md) for thresholds, limitations and incident handling.

| Area | Records |
| --- | --- |
| Restaurant/catalog | restaurant, membership, branch, dining_table, product and modifier tables |
| Table/orders | table_session, guest, order_item, assistance_request |
| Charges and responsibility | bill_entry, allocation_entry, proposal/vote tables |
| Payment protection | checkout_reservation, reservation_part |
| Payments/refunds | payment_attempt, payment_refund, refund_part, settlement_entry |
| Provider test/recovery | test_provider_intent, payment_webhook, command_receipt, audit_event |

Composite foreign keys preserve restaurant/session boundaries. JWT access checks validate current membership and token version. Guests cannot impersonate a payer, confirm manual collection or request refunds. Manager/staff permissions for financial commands are checked before idempotent replay.

## Phase 7 access and onboarding

Phase 7 adds `request_limit`, `security_event` and `auth_recovery_code`, branch policies and per-table QR versions. See [PHASE7_SECURITY.md](PHASE7_SECURITY.md) for the staff account and QR boundaries. Manager actions accept OWNER or MANAGER and are checked before cached receipt replay; cancellation of an accepted item requires that authority. Waiters retain submitted-order rejection/cancellation and manual TEST collection. Phase 8 adds owner-only staff-role changes and a narrowly authorized receipt replay after ownership transfer.

Printed links are signed table locators, not session credentials. They resolve to a staff-opened session and joining confirms that exact session ID. Joining locks the table then the active session before checking capacity or replaying a join receipt. Guest revocation, disabled tables, QR rotation and expired/closed sessions are checked on retry too.

PAY_AT_TABLE disables guest order submission in both API and UI. Staff can enter the orders while guests claim/split/pay. This is not a real external POS-bill import: the current connector remains TEST-only. Mode changes do not recalculate existing financial entries.

## Financial invariants

- Amounts use integer bani. Weighted/equal allocation uses deterministic largest remainders and UUID-string ordering.
- Every item's guest allocations equal its full adjusted charge.
- Outstanding bill = charges minus net confirmed settlements.
- Available to pay = outstanding minus active quote/payment reservations.
- Tips are separate from bill settlement and never increase another guest's share.
- A payer may cover another guest without changing that guest's item attribution.
- Each confirmed payment appends settlements for its original item/guest reservation portions.
- Refunds append negative settlements against the original payment. Charge-reducing refunds also append negative charges/allocations for the same portions.
- Pending and successful refunds both consume refundable capacity. Failed/cancelled refunds release that capacity.
- Database triggers prevent ledger/audit edits and check balance, refund limits and settlement attribution at commit.
- Legacy settlement rows without a payment ID remain readable. Reconciliation flags them as unlinked; they cannot be refunded through a fabricated payment.

The original orderer, dish recipient, financial owner and paying guest are separate concepts.

## Transactions and retries

Commands acquire an actor/key advisory lock, validate the saved request fingerprint, then take the table-session row lock. The mutation and saved response commit together. A matching retry returns the original response; a changed body under the same key conflicts.

The browser persists ordinary commands in per-tab storage before sending them. Reload restores the original actor scope, body, method and key for explicit retry. A different account cannot retry the saved command. Staff-creation passwords must be re-entered and are not stored in this record. Login and MFA enrollment keep their separate security flow. A cancelled item's immutable charge history distinguishes a replay of a submitted-item cancellation from a manager-only correction, including free accepted items.

Provider events use a provider/event advisory lock and the same session row lock. Signature verification precedes event processing. Event ID and payload fingerprint prevent duplicate or altered replays.

Concurrent table mutations compare the revision. A stale request changes nothing. Financial outcomes received from a provider do not require a customer's stale UI revision.

## Holds and outcomes

A HELD quote reservation expires after five minutes. PROCESSING reservations belong to payment attempts and do not expire on application time. They remain protected while provider outcome is unknown, even if a notification is missing.

Only an authoritative provider outcome or staff confirmation settles payment. Online cancellation first checks the provider: an already successful payment is settled, not released. Manual cash/terminal cancellation requires staff to verify no collection is in progress.

A signed notification prompts an authoritative status lookup. Out-of-order notifications cannot roll back a final result. A conflicting final provider result is an investigation error, not an instruction to charge again.

## Orders and refunds

Submitted → Accepted → Preparing → Ready → Served. The server snapshots product/options/prices and checks version/availability on approval. Eligible unpaid cancellations append reversals. Settled items require the refund flow.

A refund is either REDUCE_BILL (customer no longer owes the refunded charge) or RETURN_PAYMENT (charge remains due). Closed sessions permit charge-reducing or tip-only refunds. They are not automatically reopened. Pending refunds block table closure.

Staff can access the latest 50 closed sessions from the dashboard. Audit display is limited to the latest 100 session events.

## Provider and operations boundary

Only the local and demo profiles wire LocalTestProvider and its simulation/webhook controller. The simulator persists intents in PostgreSQL; it never contacts a bank, accepts card details or moves money. Other profiles reject payment creation, collection, cancellation, reconciliation and refund mutations, including cached payment-command replay. Existing history remains readable with normal permissions.

Its database-only operations run within the command transaction. A future external provider must use durable dispatch/recovery and provider idempotency; do not simply place remote network calls inside these locked database transactions. See PHASE5_PAYMENTS.md.

The restaurant's existing POS remains responsible for fiscal receipts. Internal reconciliation does not prove bank settlement, terminal settlement or POS reconciliation.

Restaurant onboarding, optional MFA, account revocation, rate limits and Phase 7D operational tooling are implemented. Native operational acceptance, password-recovery administration, deployment security, TLS/hosting, off-host backups and retention policies remain separate work.

## Phase 6A POS boundary

The `pos` package adds one connector account per restaurant, stable external mappings and a transactional outbox. New sessions become tracked after the manager enables the TEST POS. Capturing a changed bill projection is part of the existing session transaction, so rollback cannot leak an order into the delivery queue.

The worker claims the oldest undelivered message per session in a short transaction, commits the claim, calls the connector outside a business transaction, and acknowledges separately. Immutable message IDs/payloads, lease-token fencing and durable simulator receipts recover lost replies without repeated kitchen tickets or tenders. Failed messages block only their own session. Queue status and audit events remain visible to staff.

Catalog import uses stable product/option mappings and versioned source snapshots. POS-managed menus cannot be edited directly. Imported kitchen states only move forward. Reconciliation compares authoritative local ledger-derived projections with remote snapshots but never rewrites money to force a match.

The adapter contract and real-connector requirements are in PHASE6_INTEGRATIONS.md. The mock adapter exists only under the local and demo profiles. No bank settlement, real POS call, actual kitchen ticket or fiscal receipt is produced. This update leaves all migrations V1–V5 unchanged.

## Phase 9 customer email and interface navigation

V7 adds optional email state to customer accounts and purpose-bound VERIFY/RESET
challenges. An authenticated customer explicitly verifies and links a visit;
customer tokens never acquire table authority. Password resets revoke customer
and linked-guest token versions without editing ledger or payment records.

Verification uses row locks, committed failure counters, keyed code hashes and
a verified-address unique index/advisory lock. Delivery uses an encrypted local
outbox payload, bounded retries and guarded loopback/Mailpit SMTP. LOCAL_SMTP
records cannot count as real email ownership and are rejected in hardened mode.
See PHASE9_EMAIL.md. V1–V6 remain unchanged.

V7 also enforces one platform administrator per installation. There is no public
provisioning route. Staff roles remain scoped by restaurant: OWNER uses management
with ownership controls, MANAGER manages operations, and WAITER uses service
controls. The four React areas retain these server-side boundaries. A focused
primary navigation and More menu replace the long row of secondary actions.
