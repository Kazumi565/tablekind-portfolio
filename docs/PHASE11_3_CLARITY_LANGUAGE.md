# Public website 0.11.3: clarity and Romanian

## Changed

- The first screen states the sequence plainly: guests scan a table QR, order individually, agree to share items and see their exact part of the bill. It also states the restaurant-side benefit and TEST limitations.
- Adjacent guest and restaurant benefit panels make both audiences visible without requiring a visitor to open a demo or infer the value from the phone illustration.
- Five complete Romanian public routes under `/ro/` mirror the five English routes. A language link on every page preserves the equivalent route. It works without JavaScript and does not store a language preference or infer location.
- Romanian page metadata, menu, privacy, pilot limits, interactive example, role previews and the local-only email draft are localized. The shared HTML structure is built from an explicit phrase map; an unmapped source phrase fails the build.
- Release metadata contains language-specific canonical and alternate links and both languages appear in the release sitemap. Preview remains noindex and binds only to loopback.

## Observed in the supplied execution environment

| Check | Result |
| --- | --- |
| Website build and eight Node tests | Passed |
| Original English browser, motion and interactive-experience suites | Passed |
| Romanian browser suite | Passed across 320, 360, 390, 430, 768, 1024 and 1440 pixel widths; matching language navigation, interactions, unsent enquiry draft and no-JavaScript mode |
| Automated accessibility | Zero reported violations across existing English audits and eleven additional Romanian scans; this is not a manual accessibility certification |
| Backend, Docker, Windows PowerShell, physical phones, Tailscale | Not run for this website-only revision |

The tests use an isolated loopback site with fictional data. They do not send email, charge cards, place orders, make bookings or access the restaurant application. Translation and phrasing should be reviewed by a Romanian-speaking owner before public release. A parent’s five-minute navigation check is recommended to see whether the revised first screen answers *what it does* and *who benefits* without explanation.

## Boundaries

Payments and POS integrations in the private application remain TEST simulators; reservations remain practice-only. No domain, mailbox, hosting, production verification email or SMS was activated here. The private demo and operational app are unchanged. This ZIP is source, not a live release.
