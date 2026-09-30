# Phase 11 checkpoint

Baseline: `Tablekind_Phase11_baseline_20260924-225031.zip`, application 0.10.2. Deliverable: 0.11.0 source package with standalone `website/`; backend/frontend app versions intentionally remain 0.10.2.

## Implemented

- Warm cream/forest visual style, editorial headings, local CSS food/phone/table illustrations. No remote fonts, stock assets, fake reviews or third-party runtime dependencies.
- Responsive homepage, three interactive fictional steps, restaurant role/setup explanation, readiness disclosure, native FAQ and contact CTA.
- Separate contact, pilot-information, privacy and 404 pages. All navigation stays within the public site. No application login or admin registration links.
- Email-draft composer with required fields, bounded input lengths, no hidden submission, safe text rendering, clipboard fallback, explicit unsent state and clearing. No phone collection, browser storage or analytics.
- One-off entrances and scroll reveals, visible keyboard focus, skip link and reduced-motion support. Content remains visible without JavaScript, and no-JavaScript forms cannot silently submit.
- Node-only allowlisted static build and loopback preview, security headers, noindex preview and owner-gated release configuration. Separate development-only browser/accessibility test dependencies.
- Windows preview/testing instructions and staged domain/mailbox/hosting handoff. No deployment or purchases.

## Preserved

The complete backend, frontend operational application, V1–V9 migrations, Compose files, demo scripts, packaging script and existing documentation remain byte-for-byte equal to the uploaded archive. Only root `.gitignore` is modified in addition to the new website/documentation files. The original README and roadmap describe the restaurant-app baseline; START_PHASE11.md is the new website entry point. Integer-bani, idempotency and tenant logic were not edited.

## Not completed or claimed

No public URL, registered domain, receiving mailbox, submitted real email, account verification provider, SMS, real POS/payment/fiscal connection or restaurant pilot. The copied illustration does not interact with a real table. The existing full demo remains private and unchanged. A source-complete public presentation is not completion of operational hosting readiness.

See PHASE11_VALIDATION.md for observed checks and remaining acceptance. Next: owner views the local website, selects a domain and receiving mailbox, reviews privacy/hosting settings, then separately authorises publication. No commit, tag, push, merge or GitHub mutation has occurred.
