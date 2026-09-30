# Private demo validation

Checkpoint: Phase 6A plus private phone demo, 16 September 2026. Application version remains 0.6.0; this is an additive demo checkpoint, not a Phase 7 release.

## Completed

- Java 21 / Spring Boot backend compiled and packaged successfully.
- Backend suite: 75 tests discovered, 72 passed, 0 failures, 0 errors, 3 skipped. This run used PGlite PostgreSQL 18.3 over the SQL socket harness with one connection. The three existing native-concurrency tests deliberately skip in that supplementary environment. This is not a new native PostgreSQL 16 certification. The earlier Phase 6A native results are historical evidence, not results of this demo update.
- New backend checks reject weak/missing demo secrets and the simultaneous local/demo profiles, and confirm practice creation is unavailable in the ordinary local profile.
- New phone browser suite passed seven groups of checks at 390 × 844 with touch/mobile emulation. It exercised the actual running demo-profile backend: authenticated setup, lost-response recovery across reload, guest authorization denial, role switching, shared-food consent, exact rounding, mixed card/cash settlement, TEST POS reconciliation, new-table isolation and complete tab sign-out.
- The existing ordinary local browser suite passed all 14 check groups, including payment retries, refunds, cash handling, mobile layout and no uncaught browser errors.
- TypeScript checking and Vite production build passed. No application dependencies were added or upgraded; the existing package lock was preserved.
- Demo compose configuration parsed and inspected: unique project/volumes, separate database/user/secrets, no host ports for backend or PostgreSQL, only loopback 5180 for the web app, dedicated userspace Tailscale node, no source mounts or Docker socket mounts, and no Funnel/subnet/SSH configuration.
- All three existing Flyway migration files are byte-for-byte unchanged. No new migration is required.
- Mobile guide and POS screenshots were inspected. The guide is in normal page flow and can be hidden; it does not cover payment controls.

The new evidence is under `docs/verification/private-demo/`. Browser scripts are `frontend/tests/demo-smoke.mjs` and the existing `browser-smoke.mjs`. New Java checks are `DemoConfigurationTest` and `DemoBoundaryTest`.

## To verify on the desktop and phones

Docker, Windows PowerShell and an authenticated Tailscale network are not available in this build environment. Therefore the Docker images/health checks, Nginx demo configuration, PowerShell execution, Tailscale login/Serve and account policy have been prepared and reviewed but not run end to end here. The phone test used Chromium emulation and the Vite development proxy, not a physical iPhone/Android device or the HTTPS tunnel.

Use `START_DEMO.md`, then the startup and mobile-data access checks in `PRIVATE_DEMO.md`. Test that only the intended identities can reach the private HTTPS URL. Verify startup/restart preserves the demo database and the original local project still uses its own database. Run `npm run test:demo` against localhost:5180 to exercise the built Nginx frontend on your machine.

Before merging this update, rerun the existing native backend test command on your Docker setup. It includes the three concurrency tests skipped here. Real payment, POS and fiscal integrations remain outside this demo.

## Limitations by design

- The desktop must be awake and Docker running; this is not an always-on hosted service.
- Both reviewers need Tailscale on the phone for private access. Normal restaurant customers would not use this demo access mechanism.
- A staff sign-in is required to create/switch practice roles. Fresh tables are limited to ten per manager per hour. Earlier practice tables remain in the demo history.
- Demo roles/progress persist in the current browser tab; they are not synchronized between devices. If a sign-in expires, sign out and sign in again.
- Frontend code remains inspectable by an authorized browser user. Backend source, database credentials and signing keys are not served by the web app.
- No invitations, account changes, deployments, repository commits or pushes were made as part of this package.
