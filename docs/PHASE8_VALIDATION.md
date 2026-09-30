# Phase 8 validation — 0.8.0

Recorded 21 September 2026 (UTC). Implementation is complete. Native acceptance
is pending. Earlier 0.7.1 and 0.7.2 results are historical evidence only.

## Observed in this environment

| Check | Result |
| --- | --- |
| TypeScript, including all four interface areas | Passed with `tsc --noEmit` |
| Ordinary command-recovery unit checks | 7 passed, zero failures/skips |
| Operations helper unit checks | 7 passed; Docker subprocesses are mocked |
| New account browser script syntax | Passed Node syntax checking; no browser/API scenario execution |
| Python script syntax | Passed AST parsing |
| Migrations V1–V5 | Byte-for-byte identical to the 0.7.2 baseline |
| Compose and existing demo PowerShell scripts | Byte-for-byte identical to baseline |
| Dependency versions | Unchanged; project version and test script entry updated |
| Vite production build | Blocked: uploaded Windows dependencies lack a Linux Rolldown binding |

Java 21, javac, Maven, Docker, PostgreSQL tools and PowerShell are unavailable.
Java 17 alone cannot compile the required backend. No backend compilation or
test execution, native V6 migration, real browser run, administrator provisioning,
container startup/outage, restore or fresh dependency audit was performed here.

## Regression coverage prepared but not executed

`AccountsTest` adds 19 HTTP/SQL tests for:

- Customer/platform/staff/guest token separation and cross-restaurant denial.
- Linking and same-guest resume without changing shares, revisions or guest count.
- Rejection of duplicate/cross-account claims and concurrent same-table links.
- Revoked/closed guest denial and private visit summaries.
- Password/token revocation, single-use recovery and account deletion boundaries.
- Owner/manager/waiter permissions, promotions and protected ownership transfer.
- Role checks before receipt replay and denial for removed staff.
- Platform MFA, used-code rejection, isolated authority, audited provisioning,
  legacy owner assignment and staged administrator security replacement.

Native suite target: 123 total tests, zero failures/errors/skips, based on the
previous expected 104 plus these 19 cases. This is not an observed test count.
The new concurrent link case requires native concurrent database connections;
it skips in an explicitly supplementary PGlite run, like the earlier three
native concurrency cases. Supplementary runs cannot satisfy the native gate.

`npm run test:accounts` prepares six browser checks covering the new interfaces
and optional-account lifecycle. The platform login screen is included, but
authenticated platform browser actions and the PowerShell provisioning process
require the explicit manual gate in PHASE8_HANDOFF.md.

Run all existing payment, TEST POS, onboarding/security, operations and private
demo regressions too. The previous Phase 7D outage/backup acceptance remains
pending. No real POS, MIA, bank, terminal, fiscal or email/SMS integration exists.

## Evidence to add after Windows execution

Record actual backend totals and failures/skips, browser JSON results, build/audit
output, provisioning outcome without secrets, mobile layout review and the
isolated native outage/restore report. Keep raw dumps, credentials, QR tokens,
authenticator seeds and recovery codes outside source or shared reports.
