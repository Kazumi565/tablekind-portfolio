# Phase 5 review

The current Phase 7D installation and review steps are in [PHASE7D_HANDOFF.md](PHASE7D_HANDOFF.md). This page retains the payment regression scenarios.

These payment regression checks remain applicable in Phase 6A. The POS walkthrough is in README.md; upgrade and restart checks are in PHASE6_HANDOFF.md.

Use fictional orders, pretend cash and separate staff/Mihai/Diego tabs.

| Check | Expected result |
| --- | --- |
| Split an accepted 100.01 MDL item between two guests | Exact total preserved; changes require guest consent |
| Start a 20 MDL card payment | Pending; 20 MDL reserved; paid still zero |
| Take over the reserved item from another guest | Rejected while its payment is pending |
| Simulate Success without delivering its notification | Still pending locally; amount cannot be collected again |
| Check provider status | Success appears once, and the reserved amount becomes paid |
| Choose failure/cancelled/expired at the test provider | No settlement; shares become available for a new attempt |
| Cancel after the provider succeeded but notification was lost | Records success instead of releasing the amount |
| Enter an invalid tip after calculating checkout | Form remains usable; invalid amounts cannot be submitted |
| One guest covers another guest's items | Original item ownership remains; paying guest is recorded separately |
| Pay partly by card and partly in cash | Both payments reduce the same outstanding balance correctly |
| Request 80.01 MDL cash with a 5 MDL tip; hand over 90 MDL | Staff confirms 4.99 MDL change; only 80.01 reduces the bill |
| Try to confirm cash as a guest | Rejected; only staff can confirm collection |
| Request terminal payment | Requires a transaction reference and staff confirmation |
| Retry the same confirmed command | No duplicate charge, settlement or refund |
| Request a partial refund as a waiter | Rejected; requires manager permission |
| Request a manager refund | Pending only; no money returned until provider/manual confirmation |
| Choose Reduce the charge | Refund reduces both bill and paid amount; remaining due stays unchanged |
| Choose Return payment | Bill stays unchanged and refunded bill amount becomes due again |
| Refund more than available, including pending refunds | Rejected |
| Refund a tip only | Bill unchanged; net tips decrease |
| Open payment confirmation | Shows TEST, amount, tip, covered items and refunds; not a fiscal receipt |
| Refresh reconciliation | Confirmed net bill payments match linked ledger entries; tips are separate |
| Close a settled table with unresolved orders/requests/refunds | Rejected until those are resolved |
| Close a fully settled and served table | Succeeds; appears in recent closed sessions |
| Refund a closed table | Charge-reducing or tip-only refunds allowed; balance remains consistent |

For issues, send the account/tab, action, actual error, expected result and a screenshot.

Startup diagnostics:

```sh
docker compose ps
docker compose logs --tail=100 backend
```

Do not include access tokens or real credentials in screenshots.
