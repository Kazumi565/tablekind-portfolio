# Payment contract

This release implements TEST payment workflows and a provider boundary. It does not implement a live merchant connection. CARD and MIA are simulated methods, while CASH and TERMINAL are manual records using pretend money; all four are marked TEST in the local and demo profiles. Other profiles reject all payment/refund mutations, including manual methods and cached payment-command replay. They cannot create non-TEST manual records. Authorized historical reads remain available.

## Payment lifecycle

PENDING → SUCCEEDED, FAILED, CANCELLED or EXPIRED.

SUCCEEDED adds the reserved bill portions to the append-only settlement ledger. Other terminal outcomes release the portions. Tips are recorded separately. A refund does not change the original SUCCEEDED state; its own status and negative ledger entries preserve the history.

Provider outcome must be authoritative. An application timeout, browser close, expired quote clock or absent webhook is not evidence of payment failure. A PROCESSING reservation stays protected until reconciliation resolves it.

## API

All paths below are relative to `/api/sessions/{sessionId}`. Mutations require a valid bearer token, UUID Idempotency-Key and current revision. GET requests do not need a revision or idempotency key.

| Method/path | Access | Purpose |
| --- | --- | --- |
| POST /checkout/quote | Guest/staff | Calculate available portions without collecting money |
| POST /payments | Guest; staff for manual methods | Create a protected payment attempt |
| POST /payments/{id}/confirm | Staff | Confirm cash or physical-terminal collection |
| POST /payments/{id}/cancel | Payer/staff; manual methods staff only | Resolve cancellation without assuming failure |
| POST /payments/{id}/reconcile | Payer/staff | Check authoritative online outcome; staff also checks its pending refunds |
| GET /payments/{id}/confirmation | Payer/staff | Read confirmed payment details and refunds |
| GET /payments/reconciliation | Manager | Compare internal confirmed payments with settlement entries |
| POST /payments/{id}/refunds | Manager | Request bill/tip refund |
| POST /refunds/{id}/confirm | Manager | Confirm manual refund returned |
| POST /refunds/{id}/cancel | Manager | Cancel unreturned refund or check provider cancellation |
| POST /payments/{intentId}/test-result | Payer/staff for payment; manager for refund | Local/demo profiles only; simulate provider outcome |

Start example, covering 20 MDL of the remaining table with a 2 MDL tip:

```json
{
  "revision": 8,
  "target": "REMAINDER",
  "guestIds": [],
  "payerId": null,
  "amountBani": 2000,
  "method": "CARD",
  "tipBani": 200
}
```

Targets are SELF, GUESTS (non-empty distinct guestIds) or REMAINDER. Omit/null amountBani for the full available selection. Guests can only be the payer themselves; they may cover other guests' allocations. Staff must select payerId and use CASH or TERMINAL. Payment amount is 1–1,000,000,000 bani; tip is 0–100,000,000 bani.

Cash confirmation:

```json
{"revision":9,"receivedBani":3000,"reference":"","collected":true}
```

Cash received must cover bill plus the previously agreed tip. The difference is change. Staff must return that change before confirming. Extra cash is not silently made into a tip. If the tip needs changing before collection, staff cancel the uncollected attempt and create a new one with the agreed tip.

Terminal confirmation requires collected=true and a non-empty reference identifying the terminal transaction. A restaurant cannot reuse a successful terminal reference. The application does not operate or query the physical terminal.

Refund request:

```json
{"revision":10,"amountBani":1000,"tipBani":100,"mode":"REDUCE_BILL","reason":"Returned dish"}
```

Use amountBani=0 for a tip-only refund. Both amounts cannot be zero. REDUCE_BILL also reverses the charge and original guest allocation. RETURN_PAYMENT leaves the charge due, and is rejected for bill refunds on closed sessions. Pending refunds reserve capacity immediately; failed/cancelled refunds free it. Partial bill refunds consume original item/guest portions in deterministic UUID order, shown in the database's refund_part records; item-selective refund editing is not included.

Manual refund confirmation uses `{"revision":11,"reference":"","returned":true}`. Terminal refunds require a non-empty terminal refund reference. Corrections to an already confirmed manual collection use this audited refund flow, never an edit/delete of the original settlement.

## Test provider and signed events

The local/demo simulator persists an intent for each online payment/refund. Its final outcome cannot be overwritten. Simulation example:

```json
{"revision":12,"kind":"PAYMENT","outcome":"SUCCEEDED","deliver":false}
```

Use kind=REFUND and the refund ID for a refund simulation. deliver=false persists the provider outcome without updating the application ledger. It models a missing notification; Check provider status repairs the state later. deliver=true passes a signed envelope through the same verifier and event handler used by HTTP notifications. It does not make an external network call.

The HTTP webhook is `POST /api/payment-webhooks/local-test`, available only under the local and demo profiles. It authenticates the raw body using:

- X-Payment-Timestamp: Unix seconds, within five minutes of server time.
- X-Payment-Signature: hexadecimal HMAC-SHA256 over `timestamp + "." + rawBody`.
- A server-side TEST_WEBHOOK_SECRET; never expose it to the browser. The local profile has an explicit test-only default.

Event fields: eventId, intentId, restaurantId, kind, amountBani (bill plus tip), currency=MDL and status. The event must match the stored intent's merchant, currency and total. A duplicate ID/body is acknowledged once; an altered payload reusing an event ID conflicts. Authoritative lookup prevents a stale event from reversing a final state.

The simulator's controls require the paying guest or restaurant staff; refund simulations require a manager. Other profiles wire DisabledPaymentProvider and do not expose the simulation/webhook controller. The session snapshot reports paymentsEnabled=false and checkout is unavailable. Introducing a real provider requires explicitly revisiting this TEST-only guard after the separate integration work below.

## Confirmations and reconciliation

A payment confirmation identifies the restaurant, payer's payment, bill/tip amounts, covered items and refund history. It can be downloaded as text. It is not a fiscal receipt.

Internal reconciliation compares each payment's confirmed bill amount minus successful bill refunds against linked settlement entries. It reports tips separately and flags unlinked legacy settlement rows. It does not compare the restaurant's bank statement, physical terminal batch or POS totals, and does not claim the provider has paid out to the bank.

## Before connecting a real provider

1. Choose the restaurant's licensed provider and confirm its merchant/account model. The intended funds flow is provider → restaurant, with software fees billed separately.
2. Persist the restaurant's merchant configuration and the provider's external IDs. Tablekind UUIDs are internal references, not fabricated bank transaction IDs.
3. Add durable dispatch with provider idempotency and recovery for ambiguous network outcomes. The local adapter's operations are database-only; remote calls must not be dropped into a locked database transaction.
4. Implement the actual hosted checkout URL/session and approved return URL. A browser redirect alone must never mark payment successful.
5. Implement that provider's signature format, status lookup, cancellation/expiry guarantees and refund semantics. The local HMAC format is only a test contract.
6. Validate webhook retry/reconciliation, merchant isolation, currency/amount checks, refunds, fees and settlement reporting in the provider sandbox.
7. Connect payment methods and fiscal receipt workflow to the chosen POS, then complete operational readiness before a restaurant trial.

The generic boundary is in PaymentProvider. These provider-specific steps require real documentation, access and credentials; they have not been simulated as completed work.
