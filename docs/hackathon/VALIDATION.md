# Validation record — 11 October 2026

**Local implementation is verified; the entry is not finished.** PayPal sandbox credentials and four test accounts are configured locally. A real sandbox order was created, but PayPal declined the buyer checkout with `COMPLIANCE_VIOLATION` before approval. No capture or settlement occurred. No real AI call has been performed; Mihai explicitly selected **“No paid calls yet.”** No hosting costs were incurred.

## Completed checks

| Check | Result |
| --- | --- |
| Original baseline backend, Java 21 / PostgreSQL 16 | 151 passed, no failures/skips |
| Current backend verification | 188 full regression cases + 1 complete EUR journey passed, no failures/skips |
| New PayPal HTTP/SQL workflows with mocked gateway | 20 cases passed |
| New AI HTTP/SQL workflows with mocked interpreter | 17 cases passed |
| Combined three-diner journey with both mocked providers | 38.01 EUR settled, 0.00 remaining; 3.00 EUR tips kept separate |
| Frontend TypeScript and production build | Passed locally and in Docker |
| Browser command recovery / QR parsing | 7 / 4 passed |
| Source-review / operations tool unit tests | 6 / 7 passed |
| Frontend npm audit | No vulnerabilities after source-map-js patch update |
| Fresh isolated Compose boot, Flyway V1–V12 | Passed; original database unaffected |
| Chromium browser smoke, 390px mobile and 1440px desktop | Passed; screenshots visually inspected |
| Source publication check and Gitleaks v8.30.1 | No findings in the complete staged source; no leaks in available Git history |

Backend tests cover exact totals, tip separation, original MDL flows, durable request identities, create replay, concurrent reservations, wrong merchant/currency/gross/order relationship, duplicate settlement, lost responses, expired restart leases, cancellation during capture, pending capture, browser-independent approval, post-window GET recovery, and guest/table/restaurant boundaries. Simulator routes cannot resolve PayPal attempts.

AI tests cover exact multi-item allocation, old/new payer consent, rejection, withdrawal, invented references, invalid weights/modes/duplicates, duplicate names/dishes, stale and concurrent revisions, unauthorized confirmation, reserved items, provider failure and idempotent preview/confirmation replay.

The browser test verifies EUR seed/authentication, disabled paid-call behavior, switching all diners, reload identity persistence and layout. Its preview rendering test **intercepts the AI HTTP response with a UI fixture**; a real table mutation verifies the stale-preview guard. It does not claim real AI inference, server draft confirmation or actual PayPal checkout. Backend tests exercise those server paths with controlled mocks.

Redacted machine evidence: [backend results](evidence/backend-results.json) and [browser report](evidence/browser-results.json). Raw reports and screenshots stay in ignored `test-results/`. Earlier failed smoke checks revealed disabled-AI recovery and a test assumption about reopening the bill tab; both were corrected before the passing run.

## Reproduce local checks

```powershell
# Dedicated disposable test project, separate from both application databases.
docker compose -p tablekind-hackathon-check --profile test run --build --rm tests
python scripts/security/test_review_source.py
python scripts/ops/test_tools.py
Push-Location frontend
npm ci
npm run build
npm run test:recovery
npm run test:qr-code
npm audit --audit-level=high
npx playwright install chromium
node tests/hackathon-smoke.mjs
Pop-Location
```

Browser smoke expects the hackathon stack running and `.env.hackathon` with AI disabled. It creates one new fictional dinner per run. Do not run it against a public judging database. The existing portfolio website is unchanged; its complete separate browser suite was not rerun for these application changes.

## Required real-integration gates

### First real sandbox attempt — 11 October 2026

- Created a new EUR dinner through the local browser UI, then reserved Mihai's unchanged **19.01 EUR** share with zero tip.
- Actual PayPal authentication and Orders creation succeeded. The hosted approval page accepted the fictional buyer login and displayed **19.01 EUR**, then redirected to a `COMPLIANCE_VIOLATION` error before payment approval.
- A read-only Orders lookup confirmed `PAYER_ACTION_REQUIRED`, EUR 19.01, the configured merchant and local payment reference, and **zero captures**.
- Returned to TableKind and explicitly cancelled. Database verification found `CANCELLED` / `RESOLVED`, reservation `RELEASED`, no capture dispatch, and **zero settlement entries**. Reload preserved cancellation and restored **19.01 EUR** available to Mihai. Whole-table totals remained **0.00 EUR paid / 38.01 EUR outstanding / 0.00 EUR reserved**.
- The sandbox merchant dashboard was accessible, displayed EUR funds and no visible setup warning. The specific cause of the provider decline is unknown. [PayPal's error documentation](https://developer.paypal.com/api/payments/v2/errors/compliance_violation/) identifies the decline but does not diagnose this account.
- Capture, successful-payment replay, tip settlement and restart-after-approval checks remain **unverified against actual PayPal**. No paid AI calls were made.

### Sandbox account investigation — 11 October 2026

- Developer dashboard inspection confirmed the REST app is associated with the intended German sandbox merchant. Its account ID matches local configuration, its status is verified, and payment review and negative testing are off.
- The original German buyer is verified and has EUR 1,000 in test funds. A second German buyer also failed before approval on a minimal EUR 1.00 order, created directly through Orders v2 without TableKind descriptions, references or explicit payee. The checkout exposed `COMPLIANCE_KYC_VIOLATION`; an Orders lookup still showed `PAYER_ACTION_REQUIRED` and zero captures.
- A newly created, verified US personal sandbox buyer also failed before approval against that German merchant. A separate USD 1.00 control failed with `COMPLIANCE_VIOLATION` too. These comparisons do not establish which account triggers the provider check, but changing only the buyer or currency did not resolve it.
- The developer account is personal. [PayPal's setup documentation](https://developer.paypal.com/api/get-started/) requires a Business account for testing outside the US. This is a documented setup concern, not a confirmed explanation for the specific KYC decline. A US sandbox business merchant has been created with authorization; its separate REST app and same-country comparison are pending.
- No diagnostic order was approved or captured. Diagnostic controls are separate from TableKind ledger attempts and do not change its EUR menu or accounting.

Private screenshots and provider identifiers are retained under ignored `test-results/paypal-sandbox/` and `ops-private/paypal-sandbox-20261011/`. Redacted results are in [sandbox attempt evidence](evidence/paypal-sandbox-results.json). Resolve the sandbox account/provider issue before retrying the successful-payment gates; do not bypass it by marking a payment successful locally.

### US merchant comparison — 12 October 2026

- Created the separately authorized US sandbox merchant REST app and saved its credentials in ignored local storage. OAuth and Orders creation succeeded; returned payee IDs match the US merchant.
- The same US personal buyer that failed against the German merchant reached the **Complete Purchase** review screen on a direct EUR 1.00 control with the US merchant. No approval was submitted.
- Confirmed there were no unresolved TableKind PayPal attempts before switching local credentials. Preserved the previous configuration privately, restarted the backend, and created a new dinner bound to the US merchant. Existing restaurant bindings and the EUR ledger were not edited.
- Reserved Mihai's unchanged EUR 19.01 share with zero tip through TableKind's browser UI. Its actual hosted checkout reached the **Pay** review screen without a compliance error. The sandbox buyer displayed a USD conversion for its funding method; the order itself remains EUR 19.01.
- Before approval, read-only Orders lookups found `PAYER_ACTION_REQUIRED`, the matching merchant, the expected EUR gross amounts, and zero captures for both orders. The direct EUR 1.00 diagnostic was left unapproved.
- Mihai approved the TableKind EUR 19.01 checkout in Chrome. A subsequent authoritative Orders lookup confirmed `COMPLETED` and exactly one `COMPLETED` EUR 19.01 capture, with the correct merchant and local payment reference. The local attempt is `SUCCEEDED` / `RESOLVED`, its reservation is `SETTLED`, and its two original item settlement entries total exactly 1,901 minor units. No tip was included.
- Browser reload preserved the same succeeded payment and confirmation, with Mihai at EUR 0.00 remaining. Whole-table totals are EUR 19.01 paid / EUR 19.00 outstanding / EUR 0.00 reserved before starting the next test. No extra capture or settlement appeared. Explicit replay of the approved-payment API and restart after approval still require separate real-provider checks.
- These comparisons identify a configuration that successfully captures and settles EUR and associate the earlier pre-approval failure with the German merchant setup. They do not establish PayPal's exact KYC reason. No support message was sent and no paid AI calls were made.
- Prepared Diego's unchanged EUR 10.00 share plus a separate EUR 1.00 tip as the next real-provider test. This attempt is awaiting approval; it does not yet establish tip settlement or a completed three-diner bill.

- [ ] Configure the sandbox app, matching business merchant, EUR acceptance and three buyer accounts; keep credentials local.
- [x] On a new dinner, pay one unchanged diner share first. Inspect the actual Orders create response/approval link, capture representation, merchant, currency and gross. Confirm the local paid amount excludes tip. Verified EUR 19.01 with zero tip; a nonzero-tip checkout remains pending.
- [ ] Reload and repeat **Finish approved payment**; verify one external capture and one local settlement. Save a redacted record of local attempt/order/capture identifiers and amounts privately, then publish only nonsensitive evidence.
- [ ] Approve on PayPal, close the browser, restart the backend, and confirm the worker settles the original attempt. Exercise buyer cancellation before capture and a declined/pending sandbox outcome where supported. Controlled network-loss/race tests remain mocks; distinguish them in evidence.
- [ ] Authorize an explicit AI budget and configure a project key. Run the evaluation below and inspect the real strict-schema response. Do not claim model reliability or cost measurements from mocked tests.
- [ ] Run the actual sample instruction, review the exact split, obtain Diego and Ana's votes, and pay all three sandbox shares. Verify **38.01 EUR paid, 0.00 EUR remaining**, with tips separate.
- [ ] Test the exact judge setup or hosted HTTPS origin with a fresh browser and available sandbox buyer access. Keep it usable through judging. Record a real working demo for the video.

## Model evaluation gate

Provisional choice: `gpt-4.1-mini-2025-04-14`, using Responses strict JSON output. A fixed snapshot aids repeatability; the provider boundary permits replacement. Actual task reliability, latency and token cost are **unmeasured**. Do not treat the model choice as validated yet.

After budget approval and secure configuration, this opt-in runner makes six real preview requests and never confirms a proposal or starts a payment:

```powershell
Push-Location frontend
$env:RUN_REAL_AI_EVAL = 'approved' # Only after a budget has actually been authorized.
node tests/hackathon-ai-eval.mjs
Remove-Item Env:RUN_REAL_AI_EVAL
Pop-Location
```

Cases: the representative dinner; 2:1:1 starter weights; transfer starter to Ana; nonexistent lobster; unsupported refunds/conversion; an ambiguous referent. Require correct references, conserved cents, unchanged unspecified dishes and safe clarification. The runner checks key invariants; manually review full previews too. Repeat within the approved allowance to assess variability, then compare another strict-output model only if failures/latency justify it. Record model, pass rate, median/worst latency, actual input/output usage and cost. The configured cumulative allowance must account for all earlier calls.

Without `RUN_REAL_AI_EVAL=approved`, the runner exits without network requests. Current defaults also prohibit paid calls server-side.
