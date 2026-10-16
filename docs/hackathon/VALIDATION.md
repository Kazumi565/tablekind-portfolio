# Validation record — updated 16 October 2026

**The local and hosted real AI-to-payment journeys are verified; the entry is not finished.** Real GPT-6.1 Sol interpretation, reviewed preview, all affected diners' consent and three actual PayPal sandbox captures completed on hosted HTTPS: EUR 38.01 paid and zero outstanding. All six hosted evaluation cases passed. Seven hosted calls used an estimated USD 0.021612 in tokens within a separately authorized USD 1 test allowance; paid calls were disabled afterward. The earlier local run used seven calls at USD 0.022098 and additionally verified PayPal tips, completed-payment replay and restart recovery. The original German merchant's exact KYC reason remains unknown. Render is deployed at a dashboard estimate of USD 13.30/month, activated manually by Mihai. Ongoing judge AI access, credential delivery, video and final submission remain unfinished.

The latest menu photos, dinner guidance and AI availability interface have been published by Mihai and deployed on Render as `414c060`. The model environment now selects GPT-6 Luna; six real local Luna cases passed. Paid AI remains disabled while bounded judge access is arranged within the approved additional USD 5 allowance. The earlier hosted payment checks below describe the `b4bd14c` app with Sol; a final hosted walkthrough of the current version remains pending.

## Menu photos, first-time guidance and AI availability — 14 October 2026

- All **216 reference category entries** now resolve to their corresponding source photographs, producing **195 selectable reference dishes** alongside eight original illustrated dishes. The source supplies 195 image URLs, representing 189 distinct encoded photos because some variants share imagery. All prepared images are local 600 × 600 WebP files, individually below 129 KB, with **13,679,366 bytes** in total. The photo manifest records source URLs and SHA-256 digests. No recipe, product ID, portion, price, owner, allergen or source-category identity changed. The fixture still has **224 stored entries / 203 unique dishes / 17 categories**, independently meeting 70% source coverage per category.
- **12 catalog/photo tests**, **8 dinner-guidance tests**, **4 AI-availability tests** and **7 command-recovery tests** passed. Photo tests check every fresh and legacy recipe signature without product mutation, all file hashes and actual WebP dimensions, distinct content for the ten reference pizza recipes, category aliases and preservation of customised products. Strict TypeScript and both full/standalone production builds passed. The isolated Docker backend and frontend were rebuilt successfully with the persistent hackathon database retained.
- **25 targeted backend checks** passed against mocks or disposable PostgreSQL 16: six availability service cases, one authenticated real HTTP status test, the existing 17 AI preview/consent/ledger cases, and `HackathonMenuTest`. The HTTP status test verified authentication, guest-only access, hourly limit, unchanged table revision and balances, no usage rows consumed and no provider interactions. The menu test verified 224 rows, 203 image paths and the original ownership and EUR 38.01 bill. The earlier full 189-case suite was not rerun for this bounded change.
- The real local production app at localhost:5195 passed fresh manager sign-in and dinner creation. The start screen explains the prepared meal, one-browser perspectives and fictional funds. Keyboard dismissal returns focus to Show guide; the per-dinner preference survives navigation and reload. After reloading `/guest`, New dinner remains enabled for the verified manager. Permission loading and connection failure are described accurately rather than treated as a denied role.
- With paid AI disabled, the assistant visibly explains that state before submission, disables AI preview, and links to actual manual dish-sharing controls. That link focuses the Who covers what heading. Rechecking availability makes only the authenticated read request. The durable local AI count remained **7** throughout, with `AI_CALLS_ENABLED=false` and cumulative cap 7. No payment was initiated for these interface checks.
- A real manual starter proposal exercised the guide through proposer waiting, Diego's required agreement, Ana's required agreement and accepted-share review. Balances stayed **Mihai 19.01 / Diego 10.00 / Ana 9.00 EUR** after Diego's vote. Ana's final vote atomically applied **Mihai 14.33 / Diego 12.34 / Ana 11.34 EUR**, retaining the total **EUR 38.01**. The extra cents depend on this dinner's guest IDs. This used the actual backend and consent controls, with no AI response fixture.
- Desktop **1280 × 1020** and mobile **390 × 844** browser checks showed no horizontal page overflow. Pizza cards displayed distinct corresponding photos and exactly one Pepperoni entry; the mobile Pepperoni dialog displayed its photo, 475 g portion, allergens and EUR 7.00 price. All four original receipt photos loaded, and runtime image URLs remained local. A mobile CSS conflict that squeezed the availability notice into columns was corrected and visually rechecked: the explanation and both buttons now span the panel correctly. Final browser console errors/warnings were zero. This was viewport emulation, not a physical-phone test.
- Proof screenshots remain under ignored `ops-private/site-improvements/proofs/`. The restaurant's photo ownership is attributed separately; independent permission for public distribution has not been verified. GitHub push, Render deployment and any subsequent hosted walkthrough remain manual and pending.

## GPT-6 Luna migration — 16 October 2026

- Changed the Java fallback, hackathon profile, Compose default, Render Blueprint, PowerShell initializer and ignored local configuration to `gpt-6-luna`. Retained explicit low reasoning, Responses strict JSON output, existing validation and consent controls, and the input/output limits. The API key's model-access check returned HTTP 200 without a paid generation.
- **24 targeted backend tests passed**, with no failures or skips: 17 preview/consent cases, six availability cases and one authenticated HTTP availability case. These used mocks or disposable PostgreSQL, not paid inference.
- **Six real local Luna cases passed once each**: representative dinner, 2:1:1 starter weights, assignment to Ana, nonexistent lobster, unsupported refund/conversion and ambiguous references. Verified exact cents, EUR 38.01 conserved, unspecified dishes unchanged and safe clarification. No proposal was confirmed and no payment was initiated. Median endpoint latency was **3,111.5 ms**, worst **5,682 ms**. This is a small evaluation, not a broad reliability benchmark or a repeat of the full payment journey.
- Six completed responses reported **4,511 input / 829 output tokens**, with **80 reasoning tokens included in output**. At [Luna standard uncached rates](https://developers.openai.com/api/docs/models/gpt-6-luna) of USD 0.10/0.50 per million input/output tokens, estimated cost is **USD 0.0008656**. This is a usage estimate, not an invoice; tax and other activity are excluded. The local cumulative cap allowed exactly six additional calls, increasing recorded usage from seven to thirteen, then AI calls were disabled again.
- Render's existing app image on commit `414c0609fdf64f3448ef44f8bbcdc6f924cb3c0b` was redeployed with `AI_MODEL=gpt-6-luna`. Deployment `dep-db912qivcj2c73bhbb10` reached **Live**. Hosted call enablement and allowance were left disabled; a final hosted Luna journey remains pending. Matching source changes still require Mihai's manual GitHub publication. Earlier Sol results and costs below remain unchanged as historical evidence.
- Up to **USD 5 additional API spending** is approved for judge access. That approval does not itself configure a monetary spending cap. Redacted evaluation evidence: [Luna results](evidence/luna-results.json). Raw previews, logs and the Render proof screenshot remain ignored under `ops-private/luna-review/`.

## Local interface redesign — 12 October 2026

### Subsequent catalog correction

Removed the overlapping original Margherita, Pepperoni, berry cheesecake and tiramisu from the seed. The corrected fixture has 224 category entries; the gallery presents 203 distinct dishes, with identical cross-category selections sharing one card and retaining their category memberships. Different portions, prices, recipes and modifier choices remain separate. Existing dinners also suppress the four superseded menu entries without modifying their products, orders or financial history. The original four-item EUR 38.01 meal is unchanged. Seven catalog tests, strict TypeScript, both frontend builds and the real HTTP/PostgreSQL `HackathonMenuTest` passed; the latter verified 224 seeded products and exact original ownership/amounts. The rebuilt local frontend showed one result each for Pepperoni, Margherita, tiramisu and berry cheesecake; Mojito Cocktail appeared once in All dishes and remained accessible in both Cocktails and Bar. Earlier 228-entry checks below describe the pre-correction catalog.

- Combined the chosen menu styling with the compact dinner flow: cream/forest colors, serif headings and a photo hero; receipt photos, current shares, current → proposed preview amounts, agreement badges, collapsible demo instructions and mobile navigation. The same **228 entries, 17 categories and EUR 38.01 seed** remain in place. No backend or payment contract changed.
- Strict TypeScript, the full production build and the standalone menu build passed. Catalog synchronization and **3 menu checks**, **7 command-recovery checks** and **4 QR parsing checks** passed. The Docker frontend image built successfully, and its production app at localhost:5195 passed fresh manager sign-in and dinner creation. The earlier **189 backend cases** were not rerun for this frontend change.
- Actual local app browser checks at desktop **1280 × 1020** and mobile **390 × 844** showed no horizontal overflow. Menu and dinner views were visually inspected. This was an emulated browser viewport, not a physical-phone test.
- A fresh disabled-AI request displayed the access guard without a provider call. The READY-preview rendering check used an intercepted browser fixture, changed no ledger amounts and was not real AI inference. A real table Help event invalidated the fixture's revision and disabled confirmation.
- A separate manual **EUR 7.01 starter** proposal used the real local backend and consent flow. Original balances **Mihai 19.01 / Diego 10.00 / Ana 9.00 EUR** stayed unchanged after Mihai and Diego consented. Ana's final vote applied **14.33 / 12.34 / 11.34 EUR** atomically, preserving the EUR 38.01 total. The guest IDs determine the extra cent; this local dinner's recipients differ from the earlier hosted dinner.
- Ana ordered one **EUR 9.50 Margherita** through the actual menu. The accepted order raised the dinner total to **EUR 47.51**, with **Ana 20.84 / Mihai 14.33 / Diego 12.34 EUR** remaining. The current-share card, navigation balance and API agreed. Cocktails filtering displayed 16 entries. Menu, My order and Pay & split navigation returned to the top; More opened My account. Reload kept the selected guest on `/guest`, and returning to Pay & split preserved the exact balances.
- The production browser showed all four receipt photos loaded, the original **EUR 38.01 total / Mihai 19.01 share**, one mobile balance strip and an enabled EUR 19.01 checkout with zero tip. Desktop **1280 × 1020** and mobile **390 × 844** views had no horizontal overflow; console errors and warnings were zero. No payment was started in this checkout check.
- The More review exposed practice-reservation links whose endpoint is intentionally absent in the hackathon profile. Those links are now hidden from hackathon guest navigation and management home; the original local/demo profiles retain them. Final TypeScript, both frontend builds and the Docker rebuild passed after that correction. The final production browser confirmed zero reservation shortcuts in both places and working optional-account access.
- No additional paid AI or PayPal calls were needed for this interface work. Screenshots remain under ignored `ops-private/`; publication and the final hosted judge walkthrough remain pending.
- The complete staged-source check inspected **409 files** with no automatic findings; staged whitespace checks and manual review of the interface diff passed. No new photo assets were added, and private credentials and review screenshots remain ignored. Git-history scanning was not repeated for this interface change.

## Hosted HTTPS verification — 12 October 2026

- [Full app](https://tablekind-hackathon.onrender.com/), deployed commit `b4bd14cb9c31c80264accd18f506f7911613177b`. Render's web service and PostgreSQL 16 database are both in Frankfurt. Readiness returned UP, public UI routes/assets loaded and unauthenticated restaurant API access returned 401. The exact public GitHub branch/commit and MIT license were verified independently; Mihai performed the push.
- Chrome verified the 228-entry, 17-category photo menu, pizza/vegetarian filters, dish details and preserved EUR 38.01 dinner. A 390-pixel mobile viewport had client/scroll widths of 390 with no horizontal overflow. This was an emulated Chrome check, not a physical-phone test.
- A separate new Chrome tab required manager sign-in; the generated Render credentials worked. On its fresh dinner, searched the photo menu, reviewed Margherita's price/allergens and submitted one EUR 9.50 order. Management showed it accepted, with **EUR 47.51** total; Mihai's balance became **EUR 28.51**. This order test was separate from both settled payment dinners and made no AI call.
- On a separate fresh dinner, manual whole-bill division waited for Diego and Ana, preserved original balances until the final required vote, then applied EUR 12.67 per diner. Three sandbox payments settled EUR 38.01. Authoritative Orders lookups found one completed EUR capture per order and the configured merchant. Reload preserved settlement.
- With separately approved hosted spending and key storage, six real evaluation cases passed once each: the representative instruction, 2:1:1 weights, starter assigned to Ana, nonexistent lobster, unsupported refunds/conversion and unclear references. Exact cents and unchanged unspecified dishes were checked. Preview-only evaluations did not confirm proposals or mutate the table revision. Median endpoint latency was **6,243.5 ms**, worst **9,297 ms**. This remains a small evaluation rather than a broad reliability benchmark.
- The seventh provider call drove the real Chrome journey. The starter became **Ana 2.34 / Mihai 2.34 / Diego 2.33 EUR**, with totals **Mihai 14.34 / Diego 12.33 / Ana 11.34 EUR**. Confirmation recorded Mihai's consent; the bill stayed unchanged while Diego and then Ana voted. Ana's final vote applied the allocation atomically. No AI response itself initiated a payment.
- All three guests then approved and paid their own agreed shares through PayPal sandbox, reusing one fictional US buyer. Independent read-only Orders lookups confirmed `COMPLETED`, exactly one completed EUR capture each, the expected merchant, local payment reference and gross amount. The hosted HTTPS return origin was correct. Reload preserved **EUR 38.01 paid / 0.00 outstanding / 0.00 reserved**; management reconciliation reported **Ledger matches**, zero tips and zero unlinked entries.
- Render's safe usage logs reported **5,286 input / 1,104 output / 0 reasoning tokens** across seven completed responses. [Standard uncached model rates](https://developers.openai.com/api/docs/models/gpt-6.1-sol) of USD 2/10 per million input/output tokens give an estimated **USD 0.021612**. This is a usage-based estimate, not an invoice; tax and other account activity are excluded. The serialized-input and 4,000-output-token limits, together with the seven-call cumulative cap, bounded this run within the approved USD 1 allowance.
- Deployed `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0` after testing. Render returned Live, and a new instruction/request showed the disabled-access message without a paid call. The hosted cumulative count remains seven; ongoing judge access has not been approved. The API key stays in Render's secret environment with permission; the temporary local manager test configuration was removed.
- Redacted machine evidence: [hosted results](evidence/hosted-results.json). Provider identifiers, raw previews and screenshots remain in ignored `ops-private/hosted-review/`. The settled-table screenshot was visually inspected. A final walkthrough using the eventual judge instructions, approved ongoing AI access and delivered buyer credentials is still pending.

## Completed checks

### Render deployment preparation — 12 October 2026

- Added `Dockerfile.render`, a restricted root build context, `render.yaml`, and the optional `render` profile. The full frontend is packaged inside the Java application; known UI routes serve the app while API authentication remains in place. Render credentials are not included in source.
- `HostedFrontendTest` and `HackathonMenuTest`: **2 passed, zero failures/errors/skips**. Public UI routes and their security headers were tested alongside unauthenticated API/mutation rejection and the preserved menu fixture.
- The combined image built successfully. A disposable local app limited to **512 MB and 0.5 CPU**, with a separate **256 MB PostgreSQL 16** container, reached readiness. Five UI routes, the compiled JavaScript and a menu photo loaded; manager login and fresh dinner creation returned 228 menu entries, 17 categories and EUR 38.01. Observed memory after that check was approximately **255 MB app / 48 MB database**, not a sustained capacity benchmark. No provider credentials or calls were used.
- YAML syntax/format checking passed. At this preparation stage, resource activation, generated HTTPS-origin verification and hosted provider checks were pending. Mihai subsequently pushed the branch and activated Render manually; the completed hosted checks are recorded above. See [the full setup guide](RENDER-SETUP.md).

### Menu expansion and preview — 12 October 2026

- The shared fixture contains **228 entries in 17 categories**: 216 source selections plus the original 12. Automated checks enforce at least 70% of each included source category independently, unique identifiers and source variants, complete image references, and the original four-item **EUR 38.01** dinner. All three catalog checks passed. See [coverage](MENU-COVERAGE.md).
- Focused backend integration tests (`CatalogMenuTest,HackathonMenuTest,EurJourneyTest`): **4 passed, zero failures/errors/skips**. These verify optional image validation and projection, accepted-price preservation, complete menu seeding and idempotent replay, and the existing EUR journey. The full regression count below predates this UI change; it was not rerun for the menu expansion.
- Frontend TypeScript, ordinary production build and standalone menu build passed. Docker rebuild and startup passed with Flyway V13. The generated menu is Prettier-compatible and its synchronization check passes after formatting.
- Browser checks: all 228 entries are discoverable; the first 24 expand to 48; Pizza contains 13 entries and its vegetarian filter returns 2 verified originals; empty search resets; dish details show listed allergens; two Margheritas total EUR 19.00 in the temporary meal plan. A 390px phone viewport showed no horizontal overflow, including long sharing-platter names and portions.
- Full local app browser: signed in, started a fresh EUR dinner, opened the 228-entry menu and ordered House breakfast at EUR 7.50. The order was accepted for Mihai; his unpaid share became EUR 26.51 and the table total became EUR 45.51. This was fictional local ordering and made no AI or PayPal calls.
- The static menu preview was published **owner-private** at [TableKind menu preview](https://tablekind-at-the-table.workspace-326781.chatgpt.site). Sites returned successful deployment; the published page opened in the browser with 228 entries and its hero image loaded. It contains menu browsing and a temporary meal plan; the Spring/PostgreSQL ordering, AI and PayPal app still runs locally. This publication does not complete judge access.
- The complete staged-source checker inspected 396 files with no automatic findings. A separate comparison of local credential values against all staged blobs passed. This supplements the earlier Gitleaks run recorded below; Gitleaks itself was not rerun for this change.
- Browser screenshots remain in ignored `ops-private/menu-review/`. No project API spending, GitHub push, remote merge or release was performed for this change.

### Earlier integration verification

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
| Actual GPT-6.1 Sol evaluation, low reasoning | Six of six cases passed; exact totals, unchanged unspecified dishes and safe clarification verified |
| Actual AI preview replay | Saved READY result returned with no extra provider call, revision or bill mutation |
| Actual combined AI-to-payment journey | All affected diners agreed; three completed captures settled EUR 38.01, zero outstanding |
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
- [x] Authorize an explicit AI budget and configure a project key. Run the evaluation below and inspect the real strict-schema response. Verified within a USD 1 allowance; six real cases passed and usage measured.
- [x] Run the actual sample instruction, review the exact split, obtain Diego and Ana's votes, and pay all three sandbox shares. Verified **38.01 EUR paid, 0.00 EUR remaining**; these three payments had zero tips, with tip separation verified earlier.
- [ ] Test the exact judge setup or hosted HTTPS origin with a fresh browser and available sandbox buyer access. Keep it usable through judging. Record a real working demo for the video.

## Original model evaluation — 12 October 2026

Selected on 12 October: `gpt-6.1-sol`, using Responses strict JSON output with explicit low reasoning effort. The provider boundary permits replacement. The six representative cases below passed once each, plus a second representative request used in the browser journey. This is a small initial evaluation, not a broad reliability benchmark. The 4,000-token output cap also includes reasoning tokens; incomplete responses are rejected without creating a preview or automatically retrying. Serialized requests are limited to 32,000 UTF-8 bytes before dispatch. Safe usage logs include model, status, token counters and latency, without prompts, guest credentials, API keys or response bodies.

After the model configuration, input allowance and usage logging changes, the backend compiled and all 17 `AiSplitTest` checks passed against a disposable PostgreSQL 16 container with the AI provider mocked. Java formatting, Compose configuration validation and `git diff --check` passed. Those checks made no paid OpenAI calls. Separate real checks are recorded below. At the end of that original run, the private installation was disabled with seven calls recorded and a cumulative cap of seven; the newer Luna migration accounts for the additional six calls.

### Real AI evaluation and full journey — 12 October 2026

- Six opt-in evaluation cases returned the expected READY/CLARIFY status and passed monetary/reference checks. Full summaries, questions and previews were inspected. Median preview latency was **3,336 ms**, worst **6,467 ms**, including local API validation. The browser journey's separate representative request took **8,080 ms** at the provider boundary.
- Seven completed provider responses reported **5,409 input tokens, 1,128 output tokens and zero reasoning tokens**. Estimated token cost at standard uncached USD 2/10 per million rates is **USD 0.022098**. This is calculated from response usage, not an independently verified invoice; cached pricing, tax and other account activity are not included. The eight-call test cap and input/output limits bounded the run below the approved USD 1 allowance.
- In a separate fresh dinner, the real preview allocated the starter **Mihai 2.34 / Ana 2.34 / Diego 2.33 EUR**, leaving individual dishes unchanged. Resulting totals were **Mihai 14.34 / Diego 12.33 / Ana 11.34 EUR**. The bill stayed unchanged after confirmation and Diego's vote, then changed atomically after Ana's final vote.
- Replayed the original preview with its original key, revision and instruction. It returned the saved READY draft with no additional model call, revision or bill mutation.
- All three distinct TableKind diners reserved and paid their agreed amounts through actual hosted checkout, reusing one US PayPal sandbox buyer. Orders lookups confirmed **COMPLETED**, the expected merchant/currency/reference/gross and exactly one completed capture per order. Six settlement entries total **3,801 minor units**; three successful payments total **3,801 bill / 0 tip minor units**.
- All three authenticated guest views, management reconciliation and the database agreed: **EUR 38.01 paid, zero outstanding/reserved, Ledger matches**. After verification, disabled AI calls and recreated the backend. A fresh preview returned **503 / AI_DISABLED** with the cumulative usage still seven. Services remained healthy.
- Redacted evidence: [real AI and payment journey](evidence/real-ai-results.json). Private previews, credentials and screenshots remain ignored. The final UI screenshot was visually inspected. Judge-access verification, video and publication still require completion.

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
