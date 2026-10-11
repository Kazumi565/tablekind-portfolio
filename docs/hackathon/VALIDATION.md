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

Private screenshots and provider identifiers are retained under ignored `test-results/paypal-sandbox/`. Redacted results are in [sandbox attempt evidence](evidence/paypal-sandbox-results.json). Resolve the sandbox account/provider issue before retrying the successful-payment gates; do not bypass it by marking a payment successful locally.

- [ ] Configure the sandbox app, matching business merchant, EUR acceptance and three buyer accounts; keep credentials local.
- [ ] On a new dinner, pay one unchanged diner share first. Inspect the actual Orders create response/approval link, capture representation, merchant, currency and gross. Confirm the local paid amount excludes tip.
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
