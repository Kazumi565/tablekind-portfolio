# Phase 5 working notes

Historical Phase 5 checkpoint. Current Phase 6A results and remaining native verification are recorded in VALIDATION.md. The native Phase 5 suite subsequently passed all 47 tests with no skips.

Baseline: uploaded branch archive at commit `09e6f23ba5c527a4b74682fac4f1b4ab8d9f6af9`.
The original V1 migration stays unchanged. No hosting or repository operations are part of this change.

## Design

- All amounts are integer bani. Bill payments and optional tips are separate.
- Every attempt reserves exact item/guest portions under the existing session lock.
- A payment reservation does not expire on the application's clock. Only a definitive provider outcome or a confirmed manual cancellation releases it.
- The local test provider has durable intents, signed events and status lookup. It never accepts card details or moves money. Non-local profiles do not enable this provider.
- Webhook events are authenticated before parsing and deduplicated. The authoritative provider status is checked, including on reconciliation, so stale events cannot roll back success.
- Cash/terminal collection needs staff confirmation; a customer's request is not payment.
- Refunds require a manager, preserve original attribution, and become ledger entries only after confirmation. A refund can reduce the charge or return payment while leaving the charge due. Closed sessions allow charge-reducing refunds only (or tip-only refunds).
- Phase 6 POS/fiscal integration and a real payment-provider connector remain separate work.

## Progress

- [x] Inspect authoritative phase 5 start archive.
- [x] Add V2 payment schema and provider boundary.
- [x] Implement attempts, manual collection, reconciliation and refunds.
- [x] Connect customer and staff UI.
- [x] Add and execute regression tests (supplementary environment; native gate remains).
- [x] Package final source and Windows handoff instructions.

The user supplied a successful native PostgreSQL 16 baseline run: 26 tests, no failures or skips. That is baseline evidence, not verification of the new migration or payment code.

Final phase 5 supplementary run: 47 tests, no failures/errors, two native-concurrency checks skipped. SQL migration V1 then V2 applied to PGlite (PostgreSQL 18.3 engine); Flyway itself is disabled in that supplementary run. The browser scenario passed 14 checks. Native PostgreSQL 16/Flyway verification remains the user's next gate. See VALIDATION.md and PHASE5_HANDOFF.md.
