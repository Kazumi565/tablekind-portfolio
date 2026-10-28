# Submission checklist — 28 October 2026

The [official rules](https://paypalaihackathon.devpost.com/rules), [requirements](https://paypalaihackathon.devpost.com/) and [FAQ](https://paypalaihackathon.devpost.com/details/faqs) were rechecked on 28 October 2026. Registration and the final entry are separate steps.

## Completed

- [x] Document the existing portfolio baseline and the substantial additions in [BASELINE](BASELINE.md), with the same disclosure in the Devpost draft and planned video.
- [x] Deploy the full app and managed PostgreSQL 16 in Frankfurt. Mihai manually activated Render; the original dashboard estimate was USD 13.30/month.
- [x] Publish source with the MIT code licence. Mihai reports the changes pushed; local HEAD and the local remote-tracking ref both resolved to `b6a183e` on 17 October. New documentation edits still need his manual publication.
- [x] Verify the hosted Luna journey on 16 October: real interpretation → preview → all-diner consent → three sandbox captures → EUR 38.01 paid, zero outstanding/reserved → reload.
- [x] Verify six real local Luna evaluation cases, alongside earlier Sol evaluation, tip, replay and recovery evidence; keep the scope of each run distinct in [VALIDATION](VALIDATION.md).
- [x] Implement the menu fixture: 224 stored entries, 203 unique dishes and 17 categories. Catalog/photo, guidance, availability, build and browser checks are recorded in validation.
- [x] Enable a bounded hosted AI allowance (`AI_CALLS_ENABLED=true`, cumulative `AI_MAX_CALLS=20`) and verify one fresh hosted Luna call. USD 5 additional API usage is authorized for judging; this is not an implemented USD 5 hard billing cap.
- [x] Draft English submission text and credential-free [judge instructions](JUDGE-GUIDE.md).
- [x] Export the final 2:19.25 captioned video at 4K60, with separate SRT and editable After Effects project. All 8,355 frames decoded without errors; audio, 39 captions, UI source dimensions, and sampled scene/transition frames passed checks. Mihai selected v04 as the final presentation on 28 October. See [v04 video evidence](evidence/video-export-4k-v04-results.json). Earlier editions are retained as superseded drafts.
- [x] Create the Devpost account through GitHub and register for the PayPal AI Hackathon as Kazumi565. Devpost confirmed "Thanks for registering!" on 28 October after Mihai completed the form and explicitly authorized Register.
- [x] Create Devpost project draft `1269728` (software `1515289`) after Mihai completed the CAPTCHA. Name, pitch, story, nine technology tags, Render demo URL, GitHub branch URL and final YouTube link are saved. Devpost advanced to Additional info at 3/5 steps done.
- [x] Complete and save Additional info on 28 October: existing-project disclosure, PayPal/OpenAI technology explanation, Render sponsor selection, source/demo URLs, draft walkthrough, AI-tool disclosure and Mihai-confirmed eligibility declarations. His survey answers are 10/excellent, follow-up contact Yes, learning Significant, career AI value No (not yet). Devpost advanced to finalization at **4/5 steps done**. The project is still a draft; the final terms checkbox and Submit project were not selected. Private credential delivery remains explicitly flagged in the draft instructions.

## Required before submission

- [x] Mihai completes the eligibility and rules fields and authorizes registration; Devpost confirms registration.
- [x] Replace all 222 menu WebP assets locally with licensed representative Commons photography (78 distinct photos), add per-file licence/author/source/hash records and visible photo credits. Existing image URLs preserve stored dinners. Manual publication and hosted verification remain pending.
- [ ] Review and manually publish the new documentation. Confirm the final public source commit, deployed app version and Luna setting; use [REVIEW-AND-PUBLISH](REVIEW-AND-PUBLISH.md).
- [ ] Arrange controlled judge access to a fresh dinner and a working PayPal sandbox buyer. Do not publish manager passwords, buyer passwords, API keys, guest tokens or provider secrets in public source.
- [ ] Confirm the remaining durable AI allowance, owner monitoring and budget arrangement. Keep the hosted demo free and usable for judges through **15 December 2026, 08:00 Pacific / 18:00 Chișinău**, subject to the final rules recheck.
- [ ] Follow [JUDGE-GUIDE](JUDGE-GUIDE.md) from a fresh browser using exactly the access judges will receive. The recorded operator journey is complete; this separate access-delivery test is not yet complete.
- [x] Mihai approves v04 as the final presentation. No further video revision is requested; the approved video is uploaded as unlisted.
- [x] Publish the approved video as unlisted on YouTube with Mihai's authorization, verify anonymous playback and available 2160p60 quality, and save its link in Devpost: https://youtu.be/bPw2PLDuaUk. The live form explicitly allows public or unlisted visibility without a password.
- [ ] Fill all final Devpost links and access fields, inspect the English submission and submit manually by **12 November 2026, 12:00 PST / 22:00 Chișinău**, subject to the final rules recheck.

The assistant has not pushed GitHub, merged remote branches, published releases or submitted the final Devpost project. Hackathon registration is complete; the project draft is saved through Project details. Mihai initiated the YouTube upload and then authorized the assistant to finish it as unlisted and add the link to Devpost. YouTube copyright checks reported no issues. Licensed application-photo replacements are now prepared locally; publication and hosted verification remain pending. The owner-private Sites preview is not the judge demo; the functional app is [hosted on Render](https://tablekind-hackathon.onrender.com/).
