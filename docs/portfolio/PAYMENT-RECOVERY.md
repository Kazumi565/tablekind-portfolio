# Recovering a payment when the response is lost

Tablekind is a restaurant ordering and bill-splitting prototype built with Spring Boot, PostgreSQL and React. Its PayPal sandbox integration has to handle an awkward case: the provider may complete a payment even when the application never receives the response.

The application keeps the diner's share reserved until it can verify the original attempt. A later worker pass looks up the stored order and settles it if the capture is confirmed. In the lost-response regression test, recovery completes with exactly one call to capture.

[Watch the product walkthrough](WALKTHROUGH.md) · [Payment implementation](../../backend/src/main/java/md/tablekind/paypal/PayPalPayments.java) · [Regression tests](../../backend/src/test/java/md/tablekind/PayPalTest.java)

## The failure

A diner approves checkout. Tablekind sends a capture request. PayPal completes it, but the network connection fails before Tablekind receives the result.

The application cannot safely interpret that exception as a declined payment. Releasing the reserved share would make already-paid portions available for another checkout. Starting a new payment would also lose the connection to the first attempt. Marking the bill paid would be premature without a verified result.

The required behaviour is precise: preserve the original attempt, keep the affected portions reserved, and resolve the outcome from provider evidence.

## Persist the intent before contacting the provider

The server calculates the eligible portions under the table-session lock. It stores a payment reservation, expected merchant, currency, amount and two distinct request IDs for order creation and capture. These records are committed before a provider call starts.

This makes recovery possible after a process restart. A worker does not need the browser to remember an order or invent a new request ID. Repeated browser commands return the saved attempt through the application's idempotency handling.

Money is stored in integer minor units. The expected gross includes the reserved bill amount and any separate tip; tips do not reduce the restaurant bill.

## Keep network calls outside the database lock

The worker claims a two-minute lease in a short transaction, makes the network call outside that transaction, and reacquires the session lock to apply the result. It checks that its lease token still owns the attempt before changing state.

This avoids holding a database transaction open while waiting for PayPal. The trade-off is more persistent state and explicit ownership checks: a delayed worker response must not overwrite a newer decision.

```mermaid
sequenceDiagram
    participant App as Tablekind worker
    participant DB as PostgreSQL
    participant PP as PayPal sandbox
    App->>DB: Claim stored checkout and lease
    App->>PP: Capture original order with stored request ID
    Note over App,PP: Provider completes capture; response is lost
    App->>DB: Keep reservation; schedule another check
    App->>PP: Look up the same order
    PP-->>App: Completed capture
    App->>App: Validate identity, merchant, currency and amount
    App->>DB: Check lease and settle original reserved portions
```

## Verify the result before settling

For an existing order, `process()` performs a lookup before deciding whether another capture request is needed. If that lookup already contains the completed capture, the worker applies the result without calling capture again.

The checks cover the stored order ID, local payment reference, merchant, currency and exact gross. The nested capture must also have an acceptable status, matching amount/currency and a stable capture ID. A mismatch moves the attempt to review while keeping its reservation.

The browser's return URL is not evidence of payment. An approved order can recover even if the diner closes the tab. Cancellation also depends on timing: before capture dispatch it can release the reservation; once capture may have started, it records intent while retaining the hold until the provider outcome is known.

## What the tests establish

On **15 November 2026**, `PayPalTest` passed **20 cases with zero failures, errors or skips**, against PostgreSQL in an isolated Compose project. The gateway is mocked; this run made no PayPal or paid AI calls. The tested source revision was `7418a6593e6cbc20d20fbaf6c25136f5e8b6f3e7`.

| Scenario | Assertion in the existing suite |
| --- | --- |
| Capture response lost | Nothing is marked paid after the exception; a later lookup settles the share; capture is called exactly once. |
| Create response lost and lease expires | Recovery reuses the original create request ID. |
| Cancellation races with capture | The share stays reserved during the race; a verified completion settles it. |
| Provider details mismatch | The attempt does not settle. |
| Retry window expires | The hold remains; a known order can be checked without further capture mutations. |
| Browser never returns | The worker can recover an approved order independently. |

From the repository root, with Docker available:

```powershell
$env:COMPOSE_PROJECT_NAME = 'tablekind-payment-review'
docker compose --profile test run --build --rm tests mvn -B -ntp '-Dtest=PayPalTest' test
docker compose --profile test down --volumes --remove-orphans
```

The Compose project name separates this disposable test database from normal application services. [Verification summary](payment-recovery-verification.json).

## Limits and trade-offs

The implementation stops create/capture retries after its five-hour mutation window rather than generating fresh keys for an uncertain request. Known orders can continue through read-only reconciliation. If provider truth remains unavailable, a reservation can remain unresolved and require operator investigation.

That favours accounting safety over immediate availability of the diner's balance. The prototype uses polling; it does not implement PayPal webhooks or refunds. The automated tests prove specific application behaviours with controlled responses. The separate recorded sandbox demonstration proves a successful provider journey, not live payment readiness or an exhaustive concurrency guarantee.

The central lesson is that a network exception describes what the application observed—not necessarily what the provider did. Recovery needs durable intent, verification and a way to represent uncertainty.
