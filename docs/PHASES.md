# Delivered scope

| Phase | Included | Remaining boundary |
| --- | --- | --- |
| 1. Foundation | Spring Boot, Java 21, PostgreSQL/Flyway, authentication, validation, local containers, tests | Production provisioning and operations are later work |
| 2. Restaurant setup | Branches, roles, tables, menu translations, options, availability, hours and QR rotation | Invitations, category lifecycle and broader administrative workflows are later work |
| 3. Sessions and ordering | Join/reload, up to 20 guests, server-owned orders, approval, lifecycle, assistance and live updates | Reusable printed QR routing added in 7C; optional-account recovery of linked guests added in Phase 8 |
| 4. Billing foundations | Splits, consent, transfers, takeover, whole bill sharing, adjustments, exact rounding, quotes and temporary holds | Original five-minute quote holds remain distinct from payment attempts |
| 5. Payments | Provider-neutral attempts, durable payment holds, signed/deduplicated test notifications, manual cash/terminal confirmation, mixed and partial payments, covering others, tips/change, confirmations, manager refunds, internal reconciliation and closed-session history | All local payments are TEST. No real bank/PSP, terminal, POS or fiscal connection |
| 6A. Integration framework | POS contract, persistent TEST POS, catalog/kitchen import, transactional outbox, per-session ordering, idempotent recovery, pause/resume, queue status and reconciliation UI | Native PostgreSQL and Docker restart verification passed on Windows; production operations remain later work |
| 6B. Real integrations | Not started | Choose a restaurant/POS and licensed payment provider, implement actual order/payment/fiscal workflows and sandbox recovery |
| 7A. Product flow | Personal guest order/bill, advanced controls behind disclosure, mobile layouts, focused waiter table filters and manager tools | Full interface localization and feedback from restaurant staff remain |
| 7B. Account and access controls | Optional authenticator/recovery codes, password/session revocation, persistent request limits, audit, QR lifecycle and role checks before replay | Native concurrency verification passed on Windows; a deployment security review remains |
| 7C. Restaurant onboarding | Checklist, restaurant/branch/menu/staff forms, hours and languages, pay-at-table mode, enabled tables and reusable printable codes | Existing-account invitations and real provider onboarding need later work |
| 7D. Operations | Manager status/alerts, health probes, bounded timeouts, graceful shutdown, binary backup/checksum and isolated restore tools, disposable load/outage/recovery review, opt-in config guard and runbooks | Native Docker/PostgreSQL outage and restoration evidence completed on the user's PC; sustained load, external monitoring, hosting and controlled live trial remain separate |
| 8. Interfaces and optional accounts | Separate platform/manager/waiter/guest areas, individual staff ownership roles, private platform provisioning and MFA, optional username accounts, preferences, explicit guest linking and same-guest recovery | Native acceptance passed on Windows; supplementary and native results are linked from PHASE9_VALIDATION.md. Live email/SMS, invitations, branch roles, loyalty and public deployment remain outside scope |

| 9. Local email and simpler interfaces | Optional customer verification/reset through local Mailpit, guarded SMTP mode, durable challenge delivery, a single-platform-operator database guard, focused four-interface navigation and ten-step demo | Captured messages are TEST only. Native PostgreSQL, Windows, private-phone, outage and restore gates passed; no live email, SMS or domain setup |

| 9.1. Practice pilot review | Atomic first-table setup, anonymous daily aggregate report, explicit role-boundary tests and local/demo-only practice reservation exercise, eleven-step guide | Run this version's native Windows and phone acceptance; no capacity hold, real booking, payment/POS, domain, external email or SMS |
| 10. Optional live QR scanning | On-device guest camera scanning on browsers with BarcodeDetector, signed/temporary code validation, explicit restaurant/table preview, nickname confirmation, safe paste-link fallback and demo guidance | Browser support varies; run native builds, test the simulated camera, and check real phones over HTTPS. No domain, live email/SMS, booking or real payment/POS integration |

Five seeded tables means five physical tables, each configurable for 1–20 guests. Sessions have a 200-item limit and an item bill ceiling of 1,000,000,000 bani.

Takeaway and loyalty remain outside this release. Hosting requires a separate decision. A real restaurant trial requires real integrations, staff training and a fallback to the existing POS.
