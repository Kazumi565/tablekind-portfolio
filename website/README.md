# Tablekind public website · 0.11.3

A static, separate presentation website. The restaurant application in the parent repository remains 0.10.2 and is not hosted or exposed by this project. All full application demo payments/POS are TEST simulators; reservations are fictional.

From the repository root, with Node 22.12+:

```powershell
npm.cmd --prefix website run build
npm.cmd --prefix website run preview
```

Open http://127.0.0.1:5190 for English or http://127.0.0.1:5190/ro/ for Romanian. The language link on every page preserves the matching destination. No Docker or npm dependencies are needed for build/preview.

The opening now explains the guest flow and restaurant coordination explicitly. Two nearby panels list the concrete benefits for each audience. The site remains a presentation of a prototype, not a live ordering or payment service. Both languages cover the five public pages, their metadata, the walkthrough, role previews, enquiry draft and privacy notice. The Romanian copy should be reviewed by the owner before publication.

The opening illustration unfolds on scroll on a roomy desktop. Smaller screens show the phone followed by three upright cards. The fictional walkthrough now lets visitors choose a shared dish, set two/three/four guests, include or remove their own lemonade and inspect the matching receipt. Compact mobile steps, a native mobile menu and illustrative role workspaces make the page easier to explore. Reduced motion and the static/no-JavaScript fallback retain the story.

For tests: `npm.cmd --prefix website test`. Browser checks additionally require `npm.cmd ci` and `npm.cmd exec -- playwright install chromium` inside this directory, then `npm.cmd run test:browser`, `npm.cmd run test:motion`, `npm.cmd run test:experience` and `npm.cmd run test:bilingual`.

- [Windows start guide](../START_PHASE11.md)
- [0.11.3 clarity and Romanian validation](../docs/PHASE11_3_CLARITY_LANGUAGE.md)
- [0.11.2 interactive experience and validation](../docs/PHASE11_2_EXPERIENCE.md)
- [0.11.1 motion revision and observed checks](../docs/PHASE11_1_MOTION.md)
- [Implementation checkpoint](../docs/PHASE11_CHECKPOINT.md)
- [Observed tests and limitations](../docs/PHASE11_VALIDATION.md)
- [Domain, mailbox and static hosting handoff](../docs/PHASE11_HOSTING.md)

The contact form creates a local email draft only. Configure a monitored public address before release. No SMS or real account-verification emails are sent. Production application email requires separate work.

`npm.cmd run build:release` validates `site.config.json` before writing the static output. Never put secrets in this public configuration. Upload only `website/dist/` after explicit owner approval, not this source directory, the repository or its source ZIP. No deployment has been performed.
