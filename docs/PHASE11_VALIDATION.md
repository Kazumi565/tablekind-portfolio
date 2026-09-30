# Phase 11 validation: implementation versus execution

Date: 24 September 2026. Source package 0.11.0. Exact input: `Tablekind_Phase11_baseline_20260924-225031.zip` (restaurant application 0.10.2).

## Implemented

The standalone static website, enquiry draft composer, reduced-motion behaviour, accessibility semantics, static security headers, preview/release build guards and setup instructions are implemented. They are not a domain registration, deployment, restaurant pilot, real email delivery or payment/POS integration.

## Executed in this environment

| Check                              | Observed result                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website Node build                 | Passed; 13 allowlisted output files, no runtime package dependencies                                                                                                  |
| Website unit/build/isolation tests | 8 tests passed, 0 failed/skipped                                                                                                                                      |
| Browser suite                      | 8 grouped checks passed using Chromium 153.0.8010.0                                                                                                                   |
| Responsive coverage                | Five pages and three walkthrough states at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels; no document horizontal overflow                                         |
| Narrow form double click           | Expanded enquiry draft checked at 320 pixels; deferred scroll prevents the second click from landing on Clear form                                                    |
| Automated accessibility            | Axe 4.13: zero reported violations in 14 page/state/viewport audits plus the expanded enquiry draft; incomplete contrast findings retained for human review           |
| Keyboard and motion                | Skip link, visible focus, step activation, native FAQ, reveal on scroll, live reduced-motion change and no running animations under reduced motion passed             |
| Form safety                        | Required inputs, bounded text, safe rendering, duplicate clicks, stale draft invalidation, explicit unsent feedback and clear action passed                           |
| Clipboard and email                | Clipboard success and denied-access fallback simulated; an encoded mailto link checked using a fictional mailbox. No email was sent                                   |
| JavaScript disabled                | Content/navigation remain available; draft composer is disabled rather than submitting a GET/POST                                                                     |
| Website isolation                  | No observed third-party requests, outgoing POSTs, cookie/local/session storage, uncaught page errors or CSP violations. Application and private-file paths return 404 |
| Website dependency audit           | `npm audit` and `npm audit --omit=dev`: zero reported vulnerabilities at execution time                                                                               |
| Existing restaurant frontend       | TypeScript/Vite production build passed for unchanged 0.10.2 source                                                                                                   |
| Existing source-only regressions   | 4 QR parser tests and 7 pending-command recovery tests passed                                                                                                         |
| Baseline preservation              | 243 of 244 original files unchanged; only `.gitignore` differs. All backend/frontend files, V1–V9 migrations, Compose files and demo scripts are identical            |

The ordinary Playwright browser download returned an invalid archive in this environment. Browser execution used a locally extracted Chromium binary from the `@sparticuz/chromium` package, passed through `TABLEKIND_BROWSER_EXECUTABLE`; that package/binary is not a project dependency or part of the source ZIP. Windows uses the normal `playwright install chromium` procedure instead.

Sanitised browser results are in `docs/verification/phase11-browser.json`; accessibility detail is in `docs/verification/phase11-accessibility.json`. New runs write ignored `website/test-results/`. Desktop and mobile screenshots were visually inspected. Axe cannot conclusively evaluate some rotated/illustrated/overlapping text backgrounds, so its incomplete contrast entries are not counted as passes or silently disabled. These automated checks are not an accessibility certification.

## Not executed or not complete

- Windows execution of the new website scripts, real Android/iPhone browsers, Safari/Firefox and assistive-technology testing. Chromium viewport emulation is not a physical-device result.
- Native Docker/PostgreSQL, Flyway, backup/restore or the full authenticated restaurant/demo browser suites. No database was started or changed, and app source is unchanged. Historical native results are not new Phase 11 results.
- Real clipboard permission behaviour on every device, real mail-client handling, email send/receipt, an actual receiving mailbox or automatic form submission.
- Domain availability/purchase, DNS, Cloudflare Pages deployment, actual-host headers/HTTPS, external monitoring or public indexing.
- Owner/legal review of privacy obligations, hosting logs, operator details, enquiry retention, translations and pilot agreements.
- Production email verification, SMS, real restaurant bookings, customer money, POS, MIA, bank, terminal or fiscal integration.

## Owner acceptance

1. Extract the source into a new folder and follow START_PHASE11.md. Review the local site before changing the working repository or deploying.
2. Run the website tests on Windows. Inspect phone layouts, all step buttons, FAQs, footer links and the draft composer. Test reduced motion and keyboard navigation.
3. Decide the owned domain and receiving mailbox. Configure the public settings, review the notice and hosting checklist, then run the guarded release build.
4. Deployment requires a separate explicit decision. After any approved publication, test the real hostname, headers, contact flow and phone behaviour without using customer information.

Status: **source implementation and local automated checks complete; owner review and public setup pending**. No GitHub mutation or deployment occurred.
