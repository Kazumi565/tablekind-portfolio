# Possible version 10: hosted preview, mail verification and SMS

No hosting, domain purchase, DNS edit, external mail or SMS account is performed by 0.9.1. Keep the existing private Docker/Tailscale demo available while planning a separate hosted environment.

## Decide the audience first

1. **Private review:** retain Tailscale and optionally buy a domain only as a private address; each viewer still needs tailnet access. Local Mailpit remains test-only.
2. **Public practice preview:** use a domain/subdomain with HTTPS for the React app and route `/api` to a Java service backed by a *new* PostgreSQL instance. Apply strong secrets, invite/restrict viewers, rate-limit public actions and label simulations. Use fictional data. A managed Docker-capable host can run the backend; ensure persistent Postgres, backups and alerting. [Render's Docker documentation](https://render.com/docs/docker) describes Java services and custom domains.
3. **Real restaurant use:** a separate release after interviews, merchant agreements, security/privacy assessment, a certified payment/POS/fiscal integration, recovery plan and provider acceptance. A domain alone does not enable real transactions.

Before building a non-local hosted profile, conditionally hide the practice-reservation navigation when its local/demo-only API is unavailable. The current frontend is intended for local and demo profiles; simply pointing it at a hosted backend would leave that simulation screen unavailable.

If buying a domain, compare annual registration **and renewal** at checkout; an included platform subdomain might be enough for an early preview. [Cloudflare Registrar](https://www.cloudflare.com/domains/) describes at-cost registration and DNS/TLS services, but exact availability and price depend on the name and extension. Decide what public address to print before producing QR cards.

## Real email verification (future, disabled now)

Use a controlled sending domain/subdomain and an external transactional mail provider. The provider's domain ownership check requires the requested DNS records; [Resend's domain guide](https://resend.com/docs/add-a-domain) documents verification, DKIM/SPF and DMARC. Implement a separate `PRODUCTION_EMAIL` delivery mode with secrets in the host, bounce/abuse handling, resend limits, expiry, attempt limits and a staged cutover. Existing `LOCAL_SMTP` verification must never be treated as proof of mailbox ownership in the production mode. Keep Mailpit isolated for test fixtures and do not send private-demo codes to real addresses.

## SMS verification (possible, after need is known)

SMS is optional for accounts and reservations. Choose a provider that supports Moldova (+373), test carrier delivery and pricing, and verify how sender IDs/opt-in work. A hosted verification API such as [Twilio Verify](https://www.twilio.com/docs/verify/api/verification) can issue/check one-time codes; use phone-number validation, per-recipient/device limits, short expiry, lockout, consent, secret management and non-enumerating replies. [Moldova SMS pricing](https://www.twilio.com/en-us/sms/pricing/md) should be checked before committing to a provider. Do not store a phone number in the practice reservation table until the restaurant workflow and retention policy are decided.

Production email and SMS need vendor credentials and control over DNS/phone sending; the owner must choose and configure those accounts. Do not expose the current TEST checkout or TEST POS as live simply because the app becomes reachable on a domain.
