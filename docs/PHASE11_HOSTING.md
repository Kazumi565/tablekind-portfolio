# Public website setup, separate from restaurant hosting

## Three audiences

| Surface                       | Current plan                                       | Not enabled by this release                                |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Main domain                   | Static product presentation and demo enquiry       | Ordering, account registration, payments                   |
| Private demonstration         | Existing Docker/Tailscale demo, retained unchanged | Anonymous public access or Funnel                          |
| Future restaurant application | Separately secured hosted deployment when ready    | A real pilot, provider connectivity or production accounts |

The new website is English-only. Review Romanian copy with the team before relying on it for Romanian-language outreach. Do not claim localised pages exist yet.

## 1. Choose and own the domain

Check availability of the exact name you want at your chosen registrar. `tablekind.md` is a proposed address, not a registered or verified available domain. Check registration/renewal charges at checkout. Domain registration, static hosting and an email inbox are separate services.

Use an account and recovery email controlled by the owner. Enable MFA and save recovery codes privately. Do not paste passwords, API keys or billing details into source or chat.

## 2. Choose a receiving mailbox

A demo enquiry can initially open the visitor's email application addressed to an existing, owner-approved inbox. A custom-domain inbox is optional at this stage. **A domain purchase or a transactional email service does not automatically provide an inbox.** Verify that the chosen inbox receives email before publishing its address.

Resend and similar transactional providers are for sending application email. They are not needed for this static draft composer. No Resend account, API key or SMTP provider is configured here. Production customer-account verification needs separate backend delivery work and domain verification later. Existing local Mailpit remains TEST-only. SMS is intentionally deferred.

## 3. Confirm the public information

Edit `website/site.config.json`. This file contains public values, not secrets:

| Setting                | Required before a release build                                       |
| ---------------------- | --------------------------------------------------------------------- |
| `siteUrl`              | Your owned HTTPS origin, without a path or credentials                |
| `contactEmail`         | A single monitored receiving mailbox                                  |
| `operatorName`         | The actual person/entity responsible for the site                     |
| `hostingProvider`      | The host actually selected                                            |
| `hostingPrivacyUrl`    | The host's relevant HTTPS privacy information                         |
| `enquiryRetentionDays` | An actual 1–365 day email-enquiry retention commitment you can follow |
| `publicationReviewed`  | Set `true` only after completing the checklist below                  |

This validation checks syntax and completeness, not domain ownership, inbox delivery, privacy-law compliance or whether the commitments are actually followed. The privacy notice is an implementation-specific starting point for owner review, not a legal certification. Review applicable obligations and the actual host's logging/retention before launch. The pilot-information page is not a contract or terms of service for operational restaurant use.

## 4. Build the static release, without deploying

```powershell
npm.cmd --prefix website run build:release
```

An unconfigured release fails. The output is only **`website/dist/`**: five HTML pages, local CSS/JavaScript/icon, security headers, robots and sitemap. Never upload the repository, a complete source ZIP, `frontend/dist`, backend or private files as the presentation website.

The source package excludes all `dist` folders. Regenerate the output locally. Re-run the build after changing source/configuration. Default `build` produces a noindex preview; `build:release` creates indexable pages and canonical URLs. Tests use disposable fixture sites and do not rewrite a configured release.

## 5. Static hosting option: Cloudflare Pages

Cloudflare Pages Direct Upload accepts a folder or ZIP of static assets. When the owner is ready to deploy, use only `website/dist/`. A Direct Upload project cannot later be switched to Git integration in place; a new project is needed for that workflow. No GitHub integration or deployment has been created. See [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Choose Direct Upload initially if you want each publication to remain a deliberate manual action. Follow the current dashboard's Pages flow after reviewing the release. Uploading creates a reachable site, including its provider subdomain, so do not upload a preview assuming it is private.

For a root domain on Pages, add the domain to the Cloudflare account and follow the Pages custom-domain association and nameserver instructions. Review existing DNS records before changing nameservers; do not overwrite unrelated email settings. Add the hostname through the project's custom-domain flow before pointing DNS at it. See [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

The included `_headers` file is intended for static Cloudflare Pages responses. It denies API connections, framing, form POSTs, camera/microphone/geolocation/payment permissions and third-party resource loading. It is not served as a public asset by Pages. A different host needs equivalent response-header configuration. See [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

Do not put the restaurant backend behind this site, add `/api` proxies, publish the demo login, change Tailscale access or enable Funnel. A custom domain is an address, not a security boundary.

## 6. Owner launch checklist

- Review the wording, illustrations and honest TEST/practice limitations. No invented customers, endorsements, provider partnerships or performance improvements.
- Confirm the contact inbox, operator details, enquiry retention and hosting disclosures. Test receiving a message yourself, not with real customer data.
- Review privacy obligations and any future analytics before enabling them. The supplied site has no analytics, tracker or cookie banner because it sets no tracking cookies.
- Test the release locally, keyboard-only and on narrow screens. Review Romanian localisation needs.
- Confirm the domain, renewals, account MFA and recovery arrangements. Preserve rollback copies outside the repository as appropriate.
- After explicitly approved publication, verify HTTPS, canonical domain, 404s, headers, robots/sitemap and the contact flow on the actual hostname and real phones.
- Confirm `/api`, `/admin`, `/manage`, `/staff` and `/guest` do not expose the operational app on the presentation host.
- Remember that an email draft is not an enquiry submission. Never display "sent" unless an actual delivery/submission mechanism is implemented and confirmed.

Live application hosting, monitored backups, real email verification and providers remain separate work. Do not buy an application VPS just to serve this static presentation.
