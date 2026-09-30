# Portfolio source review

Prepared 30 September–1 October 2026 from the uploaded `tablekind-source-20260929-171658.zip`.

## Publication decision

The owner selected a **new portfolio repository**. The existing private repository, original commit history, private demo, accounts and database volumes are not part of this publication. Use [PUBLICATION.md](PUBLICATION.md) for the Windows steps.

The archive contains application version 0.10.2 and presentation-site version 0.11.3. No product version or historical test result has been relabeled as a new release.

## Reviewed and changed

- Inspected the supplied source/configuration, repository paths, email/address patterns, high-confidence token patterns and documentation. Read the original architecture, payment, integration, operational and Phase 7D handoff records in full.
- Replaced a real private tailnet hostname in the QR parser regression fixtures with the reserved `demo.tablekind.test` address. This does not change application URL validation or the existing private demo address.
- Changed fresh local bootstrap and test-login defaults to `manager@tablekind.test`, with a generic local manager display name. Existing databases are not modified or reset. Browser/API test defaults use the same new fixture email.
- Removed a named personal contact from the demo sign-in helper text. Existing practice-scenario names are fictional sample data, not exported customer records.
- Rebuilt the README with a local banner, an actual presentation-site screenshot, feature/role tables, runnable commands, architecture, design decisions, code entry points, versioned evidence and explicit limitations.
- Added a security notice, a publication guide, a source/index privacy checker and six checks covering its failure behavior. Source findings print paths and line numbers rather than credential values.
- Expanded ignore/export rules for private keys, database copies, archives and review output. Export refuses to overwrite an existing ZIP.
- Added GitHub Actions jobs with read-only permissions and pinned action revisions. They check source/history, frontend build and unit tests, native backend tests, operational helpers and presentation-site browser behavior. No deployment job exists.
- Compared all nine Flyway migration files with the uploaded baseline. **V1–V9 are byte-for-byte unchanged.**

## Secret-scan interpretation

The original directory scan with Gitleaks 8.30.1 flagged one candidate: the published RFC 6238 Base32 test seed in `SecurityPrimitivesTest.java`. It is used to check published expected TOTP values, not to authenticate an account. See [RFC 6238 Appendix B](https://www.rfc-editor.org/rfc/rfc6238.html#appendix-B).

The added configuration extends Gitleaks' default rules. Its only exception requires **both the exact test-file path and the exact published seed**. There is no blanket exclusion for tests, Java files, documentation or environment configuration.

Local Compose passwords, local signing defaults and TEST webhook values are intentional development fixtures. They are not suitable for a public running service. The private demo still requires its independently generated, excluded environment settings. No real credential was identified in the supplied source. This statement is limited to the reviewed source and the scanners' coverage.

## Checks executed during preparation

| Check | Observed result |
| --- | --- |
| Frontend TypeScript / Vite production build | Passed after the public-fixture changes |
| Saved-command recovery | 7 tests passed |
| QR parser fixtures | 4 tests passed after private-hostname removal |
| Operational helper tests | 7 tests passed |
| Publication checker regression tests | 6 tests passed |
| Website build tests | 8 tests passed |
| Website preview build | Passed |
| npm dependency audits | Frontend and website both reported zero vulnerabilities at review time |
| Website browser, motion, experience and Romanian suites | Passed in Chromium Headless Shell 134.0.6998.35, using the existing executable override |
| Website accessibility scans in those suites | No automated violations reported. This is not manual accessibility certification |
| README banner and presentation screenshot | Rendered and visually inspected, fictional data only |
| Migration preservation | All nine files match the uploaded baseline |

The default newer Chromium download was unavailable in this environment. The compatible installed headless executable was used explicitly. This does not establish behavior on every current browser or physical phone.

Final scanner/package results are recorded in [verification/public-source-review.json](verification/public-source-review.json). This review covers the exact exported source, not an unseen local checkout or hosted repository.

## Not executed or certified here

- Docker builds, the native PostgreSQL/backend suite and the outage/restore exercise were not rerun here because a Docker runtime was unavailable.
- The authenticated operational application browser suite, physical camera use, Windows PowerShell commands and the private Tailscale installation were not rerun.
- The GitHub Actions workflow was prepared locally, not executed on GitHub. Its first private-repository run is a publication gate.
- No original Git history, GitHub issue/PR content, Actions logs, release attachments or hosted settings were available in the source ZIP. The new-repository route intentionally does not import them.
- No public deployment, real payment/POS/fiscal connection, live email/SMS delivery, production security certification or restaurant trial was performed.

Historical backend evidence remains linked separately in the README. In particular, the recorded 151-test Windows run belongs to 0.9.1. It is not a new backend execution for this portfolio revision.

Automated checks can miss secrets or personal information embedded in ordinary files or images. Inspect the new private repository before changing visibility. Keep the original private repository separate.
