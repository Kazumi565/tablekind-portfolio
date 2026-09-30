# Phase 9 Windows handoff

For Mihai's Phase 7D folder and Phase 6 GitHub history, follow
[WINDOWS_UPDATE_AND_GIT.md](WINDOWS_UPDATE_AND_GIT.md) first. It uses the new
`C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring` path.

## Preserve the existing installation

Back up the source and each database you will update using OPERATIONS.md. Preserve
Git history, uncommitted work, environment files, signing/MFA secrets and the
existing private-demo/Tailscale volumes. Extract the new source ZIP separately
and review/copy its source into your existing project. Do not remove volumes or
replace your private settings with local defaults.

V7 adds customer email columns/challenges and a unique database guard allowing
at most one platform administrator. V1–V6 are unchanged. If an installation
unexpectedly has multiple platform administrators, V7 refuses to apply; stop and
review those identities with the operator. Do not automatically delete accounts
or edit migration history. Rollback requires restoring the pre-update backup in
an isolated installation with its original secrets.

No repository push, merge, public deployment or update on your PC was performed
while preparing this source. The following are commands for you to run.

## Native tests and local application

With Docker Desktop running, from the project root:

```powershell
docker compose --profile test run --build --rm tests
py -3 scripts\ops\test_tools.py
docker compose up -d --build --wait
```

Native acceptance target: 140 backend tests with zero failures/errors/skips.
Use a dedicated test database only. Reports appear in `test-results\backend`.
The application opens at http://localhost:5173; the local inbox at
http://localhost:8025. Existing restaurant credentials remain unchanged. Only a
fresh local database uses the public fictional defaults described in README.md.

From `frontend`, with Node 24:

```powershell
npm ci
npx playwright install chromium
npm run build
npm run test:recovery
npm run test:email
npm run test:accounts
npm run test:browser
npm run test:pos
npm run test:phase7
npm run test:operations
```

Use `npm.cmd` / `npx.cmd` if required by your PowerShell policy. Browser tests use
fictional data, real local SMTP capture and TEST money only. Supply your existing
test-manager credentials through TEST_STAFF_EMAIL/TEST_STAFF_PASSWORD privately;
do not disable MFA on your own account to run tests. TEST_MAILPIT_URL defaults to
http://127.0.0.1:8025 and the test helper refuses a non-loopback inbox.

## Update the existing private demo

After backing up the separate demo database, keep `.env.demo` in the same project
root and run:

```powershell
.\scripts\demo\Start-Demo.ps1
.\scripts\demo\Connect-Demo.ps1
```

Start-Demo rebuilds the app and starts Mailpit alongside the existing services.
It pauses the Tailscale sidecar while the frontend network is recreated.
Connect-Demo reconnects the existing private phone endpoint. Neither command
creates public hosting. Desktop app: http://localhost:5180. Demo Mailpit inbox:
http://localhost:8026. Show existing staff credentials privately with
`.\scripts\demo\Show-DemoLogin.ps1` if needed.

The walkthrough now has ten steps and distinct Waiter/Manager views. Its payment
and POS steps still use simulators. The last two steps show management and an
optional guest account. The host reads the guest's email code in the desktop
inbox; the inbox is not accessible through the private phone URL.

To run the updated demo browser scenario, set TEST_APP_URL to
http://localhost:5180 and TEST_MAILPIT_URL to http://localhost:8026, provide the
existing demo test credentials privately, then run `npm run test:demo` from
`frontend`. Coordinate this with anyone reviewing the demo.

## Screen changes

- Guest: Menu, My order, Pay & split and My account. Account forms have their own
  page; they no longer crowd every ordering screen.
- Waiter: Our table, Menu, Bill & sharing and Availability. Security sits in More.
- Manager/owner: Overview and service/setup sections; POS integration, System
  status and My account sit in More. Table controls appear on service screens.
- Platform: focused restaurant list/search, audit and account security, with
  private administrator sign-in and MFA. No public registration exists.

An owner still uses the manager interface, with owner-only staff/ownership
controls. Switching workspace does not grant new API permissions.

## Remaining acceptance gates

Use PHASE9_VALIDATION.md for what was actually run. Native PostgreSQL concurrency
and Flyway checks, Windows PowerShell/demo startup, authenticated platform browser
review, private phones/Tailscale, actual outage simulation and backup restoration
remain separate gates. Follow PHASE8_HANDOFF.md for private administrator
provisioning and its manual security scenarios, and OPERATIONS.md for the isolated
outage/restore review. Include the new email tables in backup fingerprints and
check restored verification/reset behavior with the original signing secret.

Also stop Mailpit temporarily: the app should keep serving dining requests while
mail remains queued. Restart it and check delivery recovery. Verify the inbox
cannot be reached from another device or through Tailscale. Do not use real
customer addresses, money or provider credentials in these tests.
