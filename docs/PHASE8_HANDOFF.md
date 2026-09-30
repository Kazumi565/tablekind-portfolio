# Phase 8 Windows handoff

Implementation version: 0.8.0. Start from your existing project, preserve private
settings and back up before migration. No repository push, merge or deployment
has been performed. Your current Docker/Tailscale configuration is unchanged.

## 1. Back up and copy the source

Review and preserve uncommitted work. Use your existing local database backup
procedure from OPERATIONS.md before rebuilding. Back up the private demo
separately if you will update it. Keep the signing/MFA secret with the private
backup; it is needed for both staff and platform authenticator decryption.

Extract `Tablekind_0.8.0_source.zip` into a new folder. Copy its `tablekind-spring`
contents into your existing project only after reviewing the changes. The ZIP
contains no `.git`, environment files, dependencies, build output or database
dumps. Preserve those private/runtime items in your installation.

The new V6 migration creates account/audit tables, adds nullable guest account
links and expands restaurant roles. It promotes only evidenced, active creators
to OWNER. V1–V5 are unchanged. Do not edit or delete old migrations and do not
remove database volumes. Once V6 is applied, rollback means restoring the
pre-update backup into an isolated installation, not deleting migration history.

## 2. Run native acceptance first

From the project root with Docker Desktop running:

```powershell
docker compose --profile test run --build --rm tests
py -3 scripts\ops\test_tools.py
```

The expected suite is 123 tests with zero failures/errors/skips. This is an
acceptance target, not an observed result. It includes 19 new account/role cases
and the earlier 0.7.2 reliability tests. Do not report historical passes as a
result for this build. Keep `test-results\backend` and any failure messages.

When the backend suite passes:

```powershell
docker compose up -d --build --wait
cd frontend
npm ci
npm run test:recovery
npx playwright install chromium
npm run test:accounts
npm run test:browser
npm run test:pos
npm run test:phase7
npm run test:operations
npm run build
npm audit
cd ..
```

Use Node 24. Use `npm.cmd` / `npx.cmd` if needed for your existing PowerShell
policy. Browser fixtures are fictional and retain their data for inspection.
Supply existing test manager credentials privately through TEST_STAFF_EMAIL and
TEST_STAFF_PASSWORD. Do not disable MFA on your primary account for tests.

The account browser test covers management, waiter restrictions, anonymous join,
optional registration/linking, same-guest recovery on another browser and the
platform login screen. Its platform authenticated workflow is deliberately
reported separately and requires the private provisioning/manual gate below.

## 3. Open each interface

| Area | Local URL | Sign-in |
| --- | --- | --- |
| Management | http://localhost:5173/manage | Existing restaurant staff credentials with OWNER/MANAGER role |
| Waiter | http://localhost:5173/staff | Individual waiter credentials created in management |
| Guest | http://localhost:5173/guest | Scan/paste an existing table QR link; no account required |
| Optional account | http://localhost:5173/guest/account | Customer username/password, separate from staff |
| Platform | http://localhost:5173/admin | Separately provisioned private administrator |

Existing QR URLs continue working. Owners use **Restaurant setup → staff** to
create individual accounts, promote/demote staff and transfer ownership. An
owner may use the waiter workspace for service without changing their actual
restaurant permissions. A waiter cannot use the management API by changing URL.

## 4. Provision your platform administrator privately

After building the updated backend and starting its database, run from the
project root:

```powershell
.\scripts\admin\Create-PlatformAdmin.ps1 -Stack local
```

Use a new private administrator email/password. The script runs a one-off
container, reads credentials over stdin and publishes no ports. For Windows
PowerShell encoding compatibility, provisioning accepts printable ASCII
credentials. It displays a new authenticator secret and one recovery code once.
Save both privately, add the secret to your authenticator (SHA1, 6 digits,
30-second period), then sign in at `/admin`. Do not copy this terminal output
into chat, test reports, screenshots or source. The script refuses to create
another administrator or overwrite one already present.

The demo has a separate database. Only if you want platform administration in
that private demo, use the same command with `-Stack demo` after building it with
your existing Start-Demo.ps1 and private `.env.demo`. This does not change
Tailscale policy or identity. Local and demo admin accounts are independent.

This PowerShell/container provisioning path has not been executed in the
development environment. Preserve any error message without sharing credentials.

## 5. Manual security and browser gate

Use fictional accounts and TEST amounts only:

- Confirm platform sign-in requires MFA and restaurant credentials cannot sign
  in there. Check platform tokens cannot read a table or restaurant workspace.
- Provision one fictional restaurant/owner. Simulate a lost response, reload and
  retry the saved request using the same initial owner password and a fresh code.
  Check only one restaurant/owner and audit event exist.
- Review any legacy restaurant without an owner. Assign only its verified
  existing manager. Confirm an existing owner cannot be overwritten.
- Create a manager and waiter. Confirm the manager can manage waiters but cannot
  create/remove managers, change roles or transfer ownership. Check this through
  the API as well as the UI. Test cross-restaurant denial.
- Transfer ownership to an existing manager. Retry the exact lost-response
  request and confirm the original result. A new transfer by the old owner must
  fail. Promote/demote staff and verify prior privileged keys cannot bypass the
  new permission.
- Join anonymously, then register and explicitly link the guest. Resume on a
  second device and confirm guest ID, guest count, bill shares and pending
  payment identity remain unchanged. Try linking two guests in the same session
  concurrently and linking a guest already owned by another account.
- With a linked guest's ordinary command pending, recover expired guest access
  using the customer account, resume that exact guest and retry the original
  command. Do not allow a different guest or changed body/key to replace it.
- Test customer password change, all-device sign-out and one-use recovery. Check
  old account and linked-guest tokens are rejected, while other guests still
  work. Delete an account after its linked tables close and verify financial
  records remain.
- Within five minutes of platform sign-in, replace administrator security.
  Check the old authenticator remains active until the new one is confirmed.
  Verify token revocation, new recovery-code use and a lost final response.
- Inspect all four interfaces on a phone. Check repeated clicks, reload,
  interrupted requests, expired sign-in and role changes while a page is open.
- Run the existing separate demo browser scenario from PRIVATE_DEMO.md, including
  its one-phone role switching and retained walkthrough. Protect the shared
  demo while another reviewer is using it.

## 6. Operational acceptance and continuation

```powershell
py -3 scripts\ops\review.py
py -3 scripts\ops\backup.py --stack local
```

Use the printed backup path with `restore_check.py` as documented in OPERATIONS.md.
Require the disposable review's `status: passed` and `nativeChaos: true`. It
includes the actual outage and isolated restore checks. Table fingerprinting
automatically includes the new account and audit tables. Also prove restored
staff/customer/admin sign-in with the original signing secret preserved.

Keep dumps and secret material private. Retain sanitized result JSON and observed
test totals, then update PHASE8_VALIDATION.md. Native acceptance is still pending
until these steps actually pass. Real integrations, public hosting and restaurant
deployment remain separate work requiring explicit authorization.
