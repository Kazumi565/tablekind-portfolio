# Phase 7A–C delivery

Version 0.7.0 extends the Phase 6/private-demo baseline `ee088a5d80bfe0bdb1199d60dde74ff4158ced6f`. The earlier checkpoint is preserved separately; this source supersedes its unfinished implementation.

## Included

- 7A: personal orders and unpaid share first, group detail and advanced checkout behind disclosure, phone layouts, waiter attention/branch filters, manager-only navigation.
- 7B: authenticator enrollment, single-use recovery codes, password change and sign-out everywhere; persistent request limits; account/restaurant activity; role checks before receipt replay; revoked-guest and QR lifecycle checks.
- 7C: restaurant/branch/menu/staff forms, practice checklist, operating mode/menu languages, reusable table QR generation, download and isolated printing.

The Java 21/Spring Boot, PostgreSQL and React/TypeScript architecture is retained. Source is prepared for the user's existing branch; no remote commits or deployments were made.

## Review and remaining work

- [PHASE7_HANDOFF.md](PHASE7_HANDOFF.md): installation, backup, native test gate and manual review.
- [PHASE7_VALIDATION.md](PHASE7_VALIDATION.md): observed checks and their limits.
- [PHASE7_SECURITY.md](PHASE7_SECURITY.md): account, QR and key-management behavior.

Phase 7D remains deferred. Real POS/payment/MIA/fiscal integrations require provider access. Full interface translation, takeaway and loyalty are not included. The private demo and its TEST labels are retained.
