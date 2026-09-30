# Phase 8 checkpoint — interfaces and optional accounts

Status: IMPLEMENTATION COMPLETE; NATIVE ACCEPTANCE PENDING.

Baseline: the completed 0.7.2 source package. The original uploaded 0.7.1
source and the 0.7.2 reliability changes are preserved. User authorized this
phase on 21 September 2026, including reasonable account/role design choices.

## Scope

- Four entry areas: private platform administration, restaurant management,
  waiter operations and guest ordering.
- Individual staff identities. OWNER is a restaurant membership role above
  MANAGER and WAITER, not a shared password or a platform administrator.
- Platform administration has separate identities, mandatory two-step sign-in,
  local provisioning and audited actions. No default administrator is seeded.
- Optional customer accounts use usernames, passwords and a recovery code.
  Email/SMS verification is not available. Anonymous QR joining stays available.
- Customer preferences, own visit history, explicit linking of a guest and
  recovery of that same active guest on another device. No change to balances
  or financial ownership, and no account-based automatic table joining.
- Add V6. Do not change V1–V5. Preserve existing TEST-only providers,
  integer bani, idempotency, tenant isolation and Docker/Tailscale setup.

## Completed implementation

1. Added V6, explicit identity-kind validation, owner permissions and separate
   platform/customer APIs. No financial ledger columns or amounts changed.
2. Added `/admin`, `/manage`, `/staff` and `/guest` experiences and optional
   `/guest/account`. Preserved existing QR URLs and private demo walkthrough.
3. Added 19 native account/authorization/linking regression cases and a six-check
   browser scenario. TypeScript, seven recovery tests and seven operations
   helper tests passed. Native and real-browser execution remain unperformed.
4. Added account model, validation and Windows handoff documentation. Saved source
   checkpoints throughout implementation; final clean package is 0.8.0.

## Continue from here

Read START_PHASE8.md, PHASE8_ACCOUNTS.md, PHASE8_VALIDATION.md and
PHASE8_HANDOFF.md. Use the 0.8.0 source ZIP as the next baseline. First run the
native backend suite and V6 migration on the isolated test database, then the
browser and private administrator gates. The expected 123-test count is not a
reported pass. Keep all real credentials and recovery material private.

The platform administrator has not been provisioned. Only the local operator
command can create the first account. There is no seeded/default platform login.
Existing restaurant creators with valid evidence migrate to OWNER; unassigned
legacy restaurants require deliberate administrator review. Customer accounts
use usernames and recovery codes because email/SMS delivery is not configured.

## Environment and acceptance

Available at the start: Node 24, TypeScript and Python. Native Java 21,
PostgreSQL, Docker and PowerShell were unavailable in the previous phase.
Uploaded Windows frontend dependencies prevent a Linux Vite build. Recheck
capabilities where useful and report only observed results. The user's Windows
native/backend/browser/outage/restore gate remains pending.

No repository push, merge, deployment or external integration is authorized.
Do not include private settings, tokens, database dumps, dependencies or build
outputs in the deliverable. Save this checkpoint with the source as work advances.
