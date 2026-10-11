# Validation record — updated 12 October 2026

**Local implementation and actual sandbox payments are verified; the entry is not finished.** A US sandbox merchant and buyer successfully settled the three unchanged diner shares: EUR 38.01 paid, zero outstanding, and EUR 1.00 tip kept separate. Completed-payment replay and restart recovery after approval passed against actual PayPal. The original German merchant failed before approval; its exact KYC reason remains unknown. No real AI call has been performed; Mihai explicitly selected **“No paid calls yet.”** Judge access and the complete AI-to-payment demonstration remain unfinished. No hosting costs were incurred.

## Completed checks

| Check | Result |
| --- | --- |
| Original baseline backend, Java 21 / PostgreSQL 16 | 151 passed, no failures/skips |
| Current backend verification | 188 full regression cases + 1 complete EUR journey passed, no failures/skips |
| New PayPal HTTP/SQL workflows with mocked gateway | 20 cases passed |
| New AI HTTP/SQL workflows with mocked interpreter | 17 cases passed |
| Combined three-diner journey with both mocked providers | 38.01 EUR settled, 0.00 remaining; 3.00 EUR tips kept separate |
| Actual PayPal sandbox, three unchanged diner shares | Three completed captures, EUR 38.01 bill paid, EUR 1.00 tip separate, zero outstanding |
| Actual PayPal recovery after approval | Backend stopped before approval, checkout tab closed, worker captured and settled the original attempt after restart |
| Actual completed-payment replay | Same-key and fresh-key approve requests returned success without extra captures or item settlements |
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
- Capture, successful-payment replay, tip settlement and restart-after-approval were **unverified at this point**; subsequent US merchant checks are recorded below. No paid AI calls were made.

### Sandbox account investigation — 11 October 2026

- Developer dashboard inspection confirmed the REST app is associated with the intended German sandbox merchant. Its account ID matches local configuration, its status is verified, and payment review and negative testing are off.
- The original German buyer is verified and has EUR 1,000 in test funds. A second German buyer also failed before approval on a minimal EUR 1.00 order, created directly through Orders v2 without TableKind descriptions, references or explicit payee. The checkout exposed `COMPLIANCE_KYC_VIOLATION`; an Orders lookup still showed `PAYER_ACTION_REQUIRED` and zero captures.
- A newly created, verified US personal sandbox buyer also failed before approval against that German merchant. A separate USD 1.00 control failed with `COMPLIANCE_VIOLATION` too. These comparisons do not establish which account triggers the provider check, but changing only the buyer or currency did not resolve it.
- The developer account is personal. [PayPal's setup documentation](https://developer.paypal.com/api/get-started/) requires a Business account for testing outside the US. This is a documented setup concern, not a confirmed explanation for the specific KYC decline. A US sandbox business merchant has been created with authorization; its separate REST app and same-country comparison are pending.
- No diagnostic order was approved or captured. Diagnostic controls are separate from TableKind ledger attempts and do not change its EUR menu or accounting.

Private screenshots and provider identifiers are retained under ignored `test-results/paypal-sandbox/` and `ops-private/paypal-sandbox-20261011/`. Redacted results are in [sandbox attempt evidence](evidence/paypal-sandbox-results.json). The US setup resolved the testing blocker; no payment was marked successful locally without authoritative capture verification.

### US merchant comparison — 12 October 2026

- Created the separately authorized US sandbox merchant REST app and saved its credentials in ignored local storage. OAuth and Orders creation succeeded; returned payee IDs match the US merchant.
- The same US personal buyer that failed against the German merchant reached the **Complete Purchase** review screen on a direct EUR 1.00 control with the US merchant. No approval was submitted.
- Confirmed there were no unresolved TableKind PayPal attempts before switching local credentials. Preserved the previous configuration privately, restarted the backend, and created a new dinner bound to the US merchant. Existing restaurant bindings and the EUR ledger were not edited.
- Reserved Mihai's unchanged EUR 19.01 share with zero tip through TableKind's browser UI. Its actual hosted checkout reached the **Pay** review screen without a compliance error. The sandbox buyer displayed a USD conversion for its funding method; the order itself remains EUR 19.01.
- Before approval, read-only Orders lookups found `PAYER_ACTION_REQUIRED`, the matching merchant, the expected EUR gross amounts, and zero captures for both orders. The direct EUR 1.00 diagnostic was left unapproved.
- Mihai approved the TableKind EUR 19.01 checkout in Chrome. A subsequent authoritative Orders lookup confirmed `COMPLETED` and exactly one `COMPLETED` EUR 19.01 capture, with the correct merchant and local payment reference. The local attempt is `SUCCEEDED` / `RESOLVED`, its reservation is `SETTLED`, and its two original item settlement entries total exactly 1,901 minor units. No tip was included.
- Browser reload preserved the same succeeded payment and confirmation, with Mihai at EUR 0.00 remaining. Whole-table totals were EUR 19.01 paid / EUR 19.00 outstanding / EUR 0.00 reserved before starting the next test. No extra capture or settlement appeared.
- These comparisons identify a configuration that successfully captures and settles EUR and associate the earlier pre-approval failure with the German merchant setup. They do not establish PayPal's exact KYC reason. No support message was sent and no paid AI calls were made.
- Stopped the backend before approving Diego's unchanged EUR 10.00 share plus EUR 1.00 tip. While stopped, an authoritative lookup found the original order `APPROVED` with zero captures. Closed the checkout tab, then started the backend without reopening the app. The worker captured the same order once for EUR 11.00 and settled only EUR 10.00 of bill portions. The reservation became `SETTLED` and the tip stayed separate.
- Replayed the completed-payment approve endpoint for Mihai and Diego using their authentic guest tokens recovered through authorized scenario-creation replay. Same-key requests and a separate fresh-key request all returned `SUCCEEDED` / `RESOLVED`. Subsequent PayPal lookups still showed exactly one capture per order and unchanged settlement counts. A cross-diner status lookup returned HTTP 403.
- Approved Ana's unchanged EUR 9.00 share through actual hosted checkout. All three Orders lookups confirmed `COMPLETED`, one completed capture each, matching merchant, EUR gross and original local reference. Four item settlement entries total 3,801 minor units; three succeeded payments have 100 tip minor units in total.
- Every authenticated guest view reports zero remaining and reserved. The management UI and internal reconciliation show EUR 38.01 bill paid, EUR 0.00 outstanding, EUR 1.00 net tips, no unlinked entries, and **Ledger matches**. The three TableKind payer identities are distinct; these payment checks reused one US PayPal sandbox buyer. The initial EUR 1.00 control was left unapproved.

- [ ] Configure the sandbox app, matching business merchant, EUR acceptance and three buyer accounts; keep credentials local.
- [x] On a new dinner, pay one unchanged diner share first. Inspect the actual Orders create response/approval link, capture representation, merchant, currency and gross. Confirm the local paid amount excludes tip. Verified EUR 19.01 with zero tip and EUR 11.00 gross with EUR 1.00 tip.
- [x] Reload and replay the **Finish approved payment** endpoint; verify one external capture and settlement of each original item portion once. Private provider IDs and redacted public results retained. After settlement the UI removes the finish button; replay was exercised through the authenticated endpoint.
- [x] Approve on PayPal, close the checkout tab, restart the backend, and confirm the worker settles the original attempt. Buyer cancellation before capture and a provider decline were verified on the earlier attempt. A genuine pending capture was not observed; pending-capture, network-loss and race tests remain mocks.
- [ ] Authorize an explicit AI budget and configure a project key. Run the evaluation below and inspect the real strict-schema response. Do not claim model reliability or cost measurements from mocked tests.
- [ ] Run the actual sample instruction, review the exact split, obtain Diego and Ana's votes, and pay all three sandbox shares. Verify **38.01 EUR paid, 0.00 EUR remaining**, with tips separate.
- [ ] Test the exact judge setup or hosted HTTPS origin with a fresh browser and available sandbox buyer access. Keep it usable through judging. Record a real working demo for the video.

## Model evaluation gate

Selected on 12 October: `gpt-6.1-sol`, using Responses strict JSON output with explicit low reasoning effort. The provider boundary permits replacement. Actual task reliability, latency and token cost are **unmeasured**. Do not treat the model choice as validated yet. The 4,000-token output cap also includes reasoning tokens; incomplete responses are rejected without creating a preview or automatically retrying.

After this configuration change, the backend compiled and all 17 `AiSplitTest` checks passed against a disposable PostgreSQL 16 container with the AI provider mocked. Java formatting, Compose configuration validation and `git diff --check` passed. These checks made no paid OpenAI calls and do not establish live model quality. The ignored local configuration retains `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0`.

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
