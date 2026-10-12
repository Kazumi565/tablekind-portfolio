# Submission checklist

Rules and FAQ checked 11 October 2026. [Official rules](https://paypalaihackathon.devpost.com/rules), [FAQ](https://paypalaihackathon.devpost.com/details/faqs).

- [ ] Mihai confirms individual eligibility and registers on Devpost. Solo entries are allowed.
- [ ] Clearly disclose the existing project and significant work added during the submission period.
- [x] Demonstrate central PayPal sandbox integration and AI use in a functional build. Complete hosted AI → consent → three sandbox captures verified on 12 October.
- [x] Public source branch includes assets, setup and MIT license; deployed commit `b4bd14c` verified on GitHub. Later documentation commits still need Mihai's manual push.
- [ ] Supply working setup or a hosted demo, plus required access instructions; keep judging access free and usable through **15 December 2026, 08:00 Pacific / 18:00 Chișinău**.
- [ ] Submit English description and testing materials.
- [ ] Publish actual device footage on YouTube, publicly visible, **under three minutes**, with permitted assets/audio.
- [ ] Submit by **12 November 2026, 12:00 PST / 22:00 Chișinău**. Recheck the official site before submission.

Local release gates:

- [ ] All real-integration gates in [VALIDATION](VALIDATION.md) pass; remove unverified claims from final materials.
- [x] Authorize the initial AI integration budget and run real checks. USD 1 approved; seven calls completed at an estimated USD 0.0221 token cost, then disabled.
- [x] Run separately approved hosted AI tests within USD 1. Six evaluation cases and one full browser journey passed; seven calls cost an estimated USD 0.0216, then hosted AI was disabled.
- [x] Deploy the full app and managed database on Render in Frankfurt. Mihai manually activated the resources at a dashboard estimate of USD 13.30/month; hosted HTTPS and provider checks passed.
- [x] Implement the expanded menu fixture: 228 entries across 17 categories, meeting at least 70% of each relevant source category, with 27 illustrative photos. See [coverage](MENU-COVERAGE.md) and [menu preview](MENU-PREVIEW.md).
- [x] Validate the menu: three catalog tests, four focused backend tests, both frontend builds, Docker/V13 and desktop/mobile browser checks passed. See [VALIDATION](VALIDATION.md).
- [x] Publish the authorized free [menu preview](https://tablekind-at-the-table.workspace-326781.chatgpt.site) on Sites. Access is owner-private; this does not complete judge access.
- [ ] Confirm ongoing AI access and full judge-access arrangements. Render hosts the functional app, but paid AI calls are disabled after testing. Provide controlled manager/buyer credentials and maintain access through judging. A domain is optional.
- [ ] Review and manually push the latest documentation commit using [REVIEW-AND-PUBLISH](REVIEW-AND-PUBLISH.md). The first eleven commits through `b4bd14c` were already pushed by Mihai.
- [ ] Complete fresh-checkout/final judge-instructions verification. The public app commit and MIT license have already been verified.
- [ ] Add final demo and video links to Devpost, inspect the completed form and submit manually.

Mihai manually pushed the source and activated Render. The assistant has not pushed GitHub, merged remote branches or published releases. Video publication and submission remain pending. The Sites preview is owner-private; the full functional app is [hosted on Render](https://tablekind-hackathon.onrender.com/), with AI disabled after the authorized test run.
