# Phase 11: public presentation website

Current source package **0.11.3**, the clarity and Romanian-language revision of the delivered 0.11.2 website. See [revision and validation](docs/PHASE11_3_CLARITY_LANGUAGE.md).

The original 0.11.0 source was based exactly on `Tablekind_Phase11_baseline_20260924-225031.zip`.
The restaurant app remains 0.10.2. This release adds a separate static website, not a live restaurant launch.

## Preserve and copy the source

Keep the working repository, `.env*`, local/demo volumes, signing/MFA secrets and Tailscale identity. No migrations were added or edited. No backend rebuild or database operation is required to view the new website.

Extract this ZIP to a **new folder** first, inspect it, then copy the source into your existing project. Do not replace `.git` or remove anything from your working tree. This package has no dependencies, build outputs or private environment files. If your source has changed since the uploaded baseline, compare the overlapping files before copying.

Relative to the original application baseline, the website lives under `website/` with its own source and tests. This revision changes only the public website, this guide and its validation document. The restaurant application and private demo remain unchanged.

## Preview on Windows, without Docker

In PowerShell, from the updated project:

```powershell
$project = 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
Set-Location -LiteralPath $project
node --version
npm.cmd --prefix website run build
npm.cmd --prefix website run preview
```

Open **http://127.0.0.1:5190/** for English and **http://127.0.0.1:5190/ro/** for Romanian. The language switch also appears on the five public pages. Keep that terminal open. Ctrl+C stops only the website preview.

Node 22.12+ is required; your Node 24 works. Build and preview use Node built-ins only, so `npm ci` is not needed just to view the website. No execution-policy change is needed. The preview binds only to loopback and does not touch ports 5173, 5180 or the Tailscale demo. This is not a public or phone-accessible hosting setup.

Scroll through the opening on a desktop, then resize to a phone width. Try all three experience steps, choose a shared dish, set two/three/four guests, toggle your own lemonade and view the matching bill. Try the reset control, mobile Menu and the role workspaces. Also review the FAQ, footer pages and enquiry composer. The composer prepares a local draft; **it does not send email**. In this unconfigured preview, there is deliberately no email-send action. No account, camera access, phone number or payment information is requested.

## Automated website checks

In a second PowerShell window:

```powershell
$project = 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
Set-Location -LiteralPath $project
npm.cmd --prefix website test
Set-Location -LiteralPath "$project\website"
npm.cmd ci
npm.cmd exec -- playwright install chromium
npm.cmd run test:browser
npm.cmd run test:motion
npm.cmd run test:experience
npm.cmd run test:bilingual
npm.cmd audit
```

Tests create their own loopback servers and fictional configuration. They do not use any running restaurant or send email. Results and screenshots go to ignored `website/test-results/`. Browser tests need Chromium and the dev dependencies; build/preview do not. See [0.11.3 validation](docs/PHASE11_3_CLARITY_LANGUAGE.md) for current results; prior website validation documents are historical.

For optional existing frontend regression checks, use `npm.cmd --prefix frontend ci`, `npm.cmd --prefix frontend run build`, `npm.cmd --prefix frontend run test:qr-code` and `npm.cmd --prefix frontend run test:recovery`. Do not call a prior native backend result a Phase 11 execution.

## What is deliberately not activated

- Domain purchase, DNS changes, hosting or a public deployment.
- A receiving mailbox or automatic enquiry submission.
- Production email verification, password-reset delivery or SMS.
- Public restaurant signup, platform-admin signup or operational application access.
- Real payment/POS/fiscal integrations, real reservations or real customer money.

The original private demo is unchanged. Keep using its existing start/connect procedure and address. There is nothing new to rebuild in that stack for this release.

## Publication comes after review

Follow [domain and hosting handoff](docs/PHASE11_HOSTING.md). The default build has a local-preview banner and noindex directives. It does not fabricate a domain or mailbox. The guarded release build removes preview-only messaging only after public configuration is filled and the owner review is explicitly recorded. Noindex is **not** access control.

No Git actions have been taken. Review `git diff --check` and `git status --short` locally. Commit, tag, push, PR and deployment are separate steps requiring your approval.
