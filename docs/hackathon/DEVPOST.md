# Devpost draft — final links and judge access still required

**Project:** TableKind — agree on the split, then pay your share

**Tagline:** Describe a shared meal in plain English, review exact cents, agree together and pay individual shares with PayPal sandbox.

**Creator:** Mihai Bargan, solo participant. Built with AI coding assistance. This is an existing portfolio project substantially extended for the hackathon; the reused foundation and new work are disclosed below and in [BASELINE](BASELINE.md).

## Inspiration

A restaurant bill mixes individual dishes and shared food. Equal division can feel unfair, while manually working out each person's items slows the end of a meal. I wanted the group to express its agreement naturally and still see exactly what every person owes.

## What it does

Three friends order individual dishes and a shared starter. A diner describes the split, then reviews an item-by-item preview and resulting totals. Everyone affected must agree before the bill changes. Each diner pays their own confirmed share through PayPal sandbox, and the table keeps an exact remaining balance.

GPT-6 Luna interprets the request into structured item and diner references. TableKind validates those references and computes money deterministically. Ambiguous or unsupported requests require clarification. The model cannot move money or consent for another diner.

PayPal completes the experience: Orders v2 creates an order for the reserved share, PayPal hosts buyer approval, and the backend verifies the order, merchant, currency and capture amount before settling those portions. Durable records and reconciliation support retries and interrupted browser sessions.

## How I built it

Java 21, Spring Boot, PostgreSQL, React, TypeScript and Docker. The hosted demo runs on Render with a persistent database. The interpreter uses OpenAI Responses with low reasoning and strict structured output.

The project began as a restaurant SaaS idea and became a portfolio application before this hackathon. That baseline already had ordering, an integer ledger, manual sharing proposals and votes, command idempotency and simulated payments. For this entry, I added the isolated EUR scenario, real PayPal sandbox Orders v2 integration, hosted AI interpretation, reviewed multi-item proposals, provider recovery and the three-diner interface. The original MDL history is preserved. This is an extension of existing work, not a claim that the whole application was built during the event.

AI coding tools helped with implementation, tests, debugging and presentation preparation. I directed the work, reviewed behavior and tested the actual application. The demonstration uses synthetic Andre narration and a generated and retouched photograph of three fictional diners, animated in After Effects. Its interface views are high-density captures and rendered UI exports from real app and PayPal sandbox runs, edited as held views rather than continuous 4K screen recording.

## Challenges I ran into

The difficult part was keeping the group's agreement and payment state correct across delayed responses. A preview can become stale while the table changes, so it carries a revision and must be reviewed again. A successful redirect is not proof of payment, so the backend checks the stored order and completed capture before updating the ledger. Payment network calls happen outside database locks, and recovery continues from the original attempt.

Rounding also matters. Sharing a EUR 7.01 starter equally produces EUR 2.33, EUR 2.34 and EUR 2.34. The server assigns the remainder deterministically so no cent disappears.

## Accomplishments I'm proud of

The current hosted GPT-6 Luna journey completed a real preview, all three diners' consent and three actual PayPal sandbox captures. It settled EUR 38.01 with zero outstanding and zero reserved; those totals survived reload. The six representative local Luna evaluation cases also passed, including ambiguous and unsupported requests. These are bounded tests rather than a claim of universal model reliability.

The payment integration was separately checked for tips, completed-payment replay and recovery after approval while the backend was stopped. Those earlier recovery checks are documented separately from the current recorded walkthrough.

## What I learned

A useful AI payment experience needs clear responsibilities: natural language helps express intent, deterministic code checks financial facts, and people approve changes to their own responsibility. Preview and consent are essential parts of the experience.

## What's next for TableKind

Finish controlled judge access and gather feedback on the dinner flow. Beyond the hackathon, I would validate the workflow with restaurants and work through the requirements for a production payment rollout. PayPal refunds, live payments, fiscal receipts and real POS integration are outside this entry's scope.

## Submission fields and final checks

- **Built with:** Java, Spring Boot, PostgreSQL, React, TypeScript, Docker, OpenAI Responses API, GPT-6 Luna, PayPal Orders v2, Render.
- **Source:** [hackathon/paypal-bill-splitting](https://github.com/Kazumi565/tablekind-portfolio/tree/hackathon/paypal-bill-splitting). Local HEAD and the local remote-tracking ref both resolved to `b6a183e` on 17 October. The recorded hosted app image is `414c060`, with its environment selecting Luna. Recheck the public branch and deploy the matching reviewed source before the final submission check.
- **Demo:** [TableKind full app](https://tablekind-hackathon.onrender.com/).
- **Testing instructions:** [JUDGE-GUIDE](JUDGE-GUIDE.md). Controlled manager and sandbox-buyer access must be delivered through the permitted judge-access channel; this public document contains no passwords or API keys.
- **Video:** [Final v04 demo on YouTube](https://youtu.be/bPw2PLDuaUk). Mihai selected revision **v04** as the final presentation on 28 October. The 139.25-second, 3840 × 2160, 60 fps captioned export passed full decode, audio, source-resolution and sampled visual checks. All 8,355 frames decoded without errors. The owner package includes a separate SRT and editable After Effects project with all 37 media dependencies. Published as unlisted with Mihai's authorization on 28 October; anonymous playback and availability of 2160p60 were verified in Chrome Incognito. The link is saved in the Devpost draft. See [delivery notes](VIDEO.md).
- **AI access:** Hosted AI is enabled with a cumulative 20-call allowance as last verified on 16 October. An additional USD 5 judge budget is authorized, but the application enforces a call count, not a dollar cap. Confirm remaining allowance and access through the judging period before claiming the demo is ready for judges.
- **Evidence:** [Current hosted Luna walkthrough](evidence/hosted-luna-results.json), [Luna evaluation](evidence/luna-results.json) and [full validation record](VALIDATION.md).
- **Asset rights:** Restaurant reference photos have been replaced locally with licensed representative Wikimedia Commons photographs, including legacy image URLs. Per-file source, author, licence and modification records are in MENU-PHOTOS.json and the public photo-credits page. Adaptations retain their original licences; MIT applies to code. Publish these replacements and verify the hosted assets before final submission. The already approved video remains unchanged and retains its recorded presentation imagery.

Do not submit this draft with placeholders or unavailable access. Eligibility, required dates and the final form must be checked against the [official rules](https://paypalaihackathon.devpost.com/rules) before Mihai submits manually.
