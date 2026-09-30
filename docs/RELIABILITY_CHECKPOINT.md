# Reliability update checkpoint

Historical 0.7.2 checkpoint. Continue from PHASE8_CHECKPOINT.md for version 0.8.0.

Status: IMPLEMENTATION COMPLETE; NATIVE ACCEPTANCE PENDING.

Baseline: uploaded tablekind-spring.zip, version 0.7.1 through Phase 7D.
Baseline SHA-256: 6fb4242abff22778cdd45d47be54901c8284ca2a0f60b8a4c8ab164a8d305f4c.
The required ten handoff documents were read before editing. The user approved
the focused fixes below. No deployment, Git operation or external integration is authorized.

## Approved scope

1. Persist ordinary uncertain browser commands before dispatch and recover the
   same actor, method, body and idempotency key after reload. Do not persist
   passwords, MFA secrets or bearer tokens in command recovery records.
2. Allow a waiter to replay their successful cancellation of a submitted item,
   while keeping manager authority checks for previously accepted items and
   current membership/token revocation checks.
3. Reject payment creation/collection/refund mutations with an unconfigured
   provider profile. Local and private-demo payments remain TEST-only.
4. Add focused regression coverage, correct conflicting reference documentation,
   validate available checks and package source without private/runtime files.

## Progress

- Version 0.7.2 implementation is present in this checkpoint.
- Ordinary commands are saved before dispatch with the same key/body/actor on
  recovery. Staff-creation passwords are requested again, never stored in the
  recovery record. Account changes cannot reuse another actor's command.
- Waiter cancellation replay uses immutable charge history to distinguish a
  submitted-item cancellation from a manager correction. No migration is needed.
- Payment mutations and cached payment receipts are blocked outside TEST profiles.
- Added seven browser-command unit checks, three backend cancellation cases and
  six backend payment-boundary cases. Browser regression now includes reload
  after lost join/order/payment responses.
- Seven recovery unit checks, seven operations helper checks and TypeScript validation passed. See RELIABILITY_VALIDATION.md for exact limits.
- Documentation and clean source packaging are complete. The package includes no environment files, Git metadata, dependencies, build outputs or database dumps.
- Original source remains in the uploaded archive. Do not edit migrations V1-V5.
- Preserve existing Docker/Tailscale projects, private settings and database volumes.

## Available evidence and limitations

Baseline saved evidence: 95 backend tests, 92 passed, 3 native concurrency cases
skipped in the supplementary PGlite environment. Earlier browser results are
historical baseline evidence, not validation of this update.

The current environment has Node 24 and Java 17, but no Docker, PostgreSQL tools,
PowerShell or Java 21 build environment. The full frontend build is blocked by
Windows dependency binaries in the supplied archive; reinstall with npm ci on
the target PC before building. Dependencies and lockfile versions were not updated.
Native backend, actual browser/API, outage and restoration validation must still
run on Windows as described in PHASE7D_HANDOFF.md.

## Continuation

Read this file first, then RELIABILITY_VALIDATION.md and PHASE7D_HANDOFF.md.
Next run the native backend suite (target: 104 tests without skips), browser
scenarios, isolated outage review and backup restoration on Windows. Save the
actual reports before marking native acceptance complete. Do not claim any
unexecuted tests passed.

Recovery is per browser tab using sessionStorage. Closing the tab, manually
clearing browser data, expired guest access or corrupt/unavailable storage may
require staff to reconcile the last action. Authentication/MFA operations use
their existing separate flows. Replaying a staff-creation command requires the
same password to reproduce its original fingerprint; a conflicting retry stays
pending. There is no automatic replay or silent discard of an uncertain command.
All payment/POS/fiscal connections remain simulators or unconfigured. Never use
customer money. Do not include environment files, database dumps or access tokens
in deliverables. Do not add tool/model attribution to project files or commits.
