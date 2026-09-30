# Reliability update validation — 0.7.2

Recorded 20–21 September 2026 (UTC). Implementation is complete; native acceptance
is pending. The historical 0.7.1 results in PHASE7D_VALIDATION.md must not be
reported as results for this update.

## Checks actually executed

| Check | Observed result |
| --- | --- |
| Browser-command recovery unit tests | 7 passed, zero failures/skips, using Node 24.19.0 |
| Frontend TypeScript | Passed with `node node_modules/typescript/bin/tsc --noEmit` |
| Operations helper unit tests | 7 passed using `python -B scripts/ops/test_tools.py`; Docker subprocesses are mocked |
| Browser scenario syntax | Passed `node --check tests/browser-smoke.mjs`; this does not execute Chromium or API scenarios |
| Python syntax | All scripts parsed successfully; this is not a Windows or Docker execution |
| Flyway preservation | V1–V5 byte-for-byte identical to the uploaded baseline |
| Private-demo preservation | All four Compose files and six demo PowerShell scripts byte-for-byte identical to the baseline |
| Dependencies | Lockfile dependency versions unchanged; only the project version changed |
| Full frontend build | Blocked: uploaded Windows command shims are not executable here; direct Vite invocation also fails because the Linux native Rolldown binding is absent |

Recovery unit tests cover exact original body/key retention across reload,
anonymous joining, account/role mismatch, staff-password redaction, corrupt
records, unavailable storage and uncertain versus definite responses. They
exercise the recovery helper; the new React/browser paths still need the actual
browser regression below.

The available runtime has Java 17, not the required Java 21. Docker, native
PostgreSQL client/server tools, PowerShell and Maven are unavailable. No backend
compilation, native database execution, container outage or restoration was
performed for 0.7.2. No fresh dependency audit was executed.

## Added coverage awaiting execution

- Three backend cancellation tests: waiter replay has the same receipt/revision,
  altered body/new key cannot duplicate it, removed membership denies replay,
  and a previously accepted free item still needs manager authority.
- Six backend payment-boundary cases: CASH, TERMINAL, CARD and MIA creation all
  reject an unconfigured provider, existing payment/refund/event mutations reject
  without side effects, and the controller checks capability before receipt replay.
- Browser payment regression now covers a successful join, order and payment
  whose response is lost, followed by reload and retry without duplicate effects.
  The order retry asserts the same transmitted key/body; join and payment verify
  the persisted recovery record is unchanged across reload.

The expected native suite grows from 95 to 104 tests. This count is a target
based on the added cases, not a test-run result. The earlier supplementary
95-total / 92-passed / 3-skipped result remains historical evidence only.

## Windows acceptance sequence

Use PHASE7D_HANDOFF.md to back up and apply the source without changing private
settings or volumes. With Docker Desktop running, from the project root:

```powershell
docker compose --profile test run --build --rm tests
py -3 scripts\ops\test_tools.py
py -3 scripts\ops\review.py
```

Require zero backend failures/errors/skips. Require the isolated operations
review to finish with `status: passed` and `nativeChaos: true`, including its
real outage and backup/restore comparisons. Retain sanitized reports privately.

After starting the local app, from `frontend` using Node 24:

```powershell
npm ci
npm run test:recovery
npx playwright install chromium
npm run test:browser
npm run test:pos
npm run test:phase7
npm run test:operations
npm run build
npm audit
```

Run the separate private-demo browser scenario using the existing private
configuration as described in PRIVATE_DEMO.md. Check the phone layout and
one-phone guest/staff switching. Preserve its Tailscale identity and secrets.

Also manually check a lost staff-account-creation response: reload, confirm no
password is stored in the command record, re-enter the same initial password,
retry and verify only one membership exists. Check expired staff sign-in asks
for the same account before recovery. Use fictional accounts and TEST payments.

Complete backup.py and restore_check.py for the working local/demo databases as
described in the handoff. Keep dumps and signing/MFA secrets private and outside
the source ZIP. Do not deliberately interrupt the shared demo to test outages.

No live POS, MIA, bank, terminal or fiscal integration was implemented or tested.
No real money, public hosting, repository push, merge or deployment was used.
