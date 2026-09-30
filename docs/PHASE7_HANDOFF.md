# Install and review Phase 7A–C

Historical 0.7.0 instructions. For the current update, use [PHASE7D_HANDOFF.md](PHASE7D_HANDOFF.md).

Version 0.7.0. This update builds on the merged Phase 6/private-demo source. It leaves Phase 7D for the next round. Nothing is deployed or pushed to GitHub by this package.

## Preserve the working copy

Use normal PowerShell in your existing project:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring"
git branch --show-current
git status --short
```

Use your `phase-7-product-hardening` branch. Preserve any uncommitted changes before copying. Keep the working `.git`, `.env` and `.env.demo`. The archive contains none of those secrets or Git history.

Back up committed source:

```powershell
git archive --format=zip --output="..\tablekind-before-phase-7.zip" HEAD
```

Back up the database you will update. For the ordinary local stack:

```powershell
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U tablekind -d tablekind -Fc -f /tmp/before-phase7.dump
docker compose cp postgres:/tmp/before-phase7.dump ..\tablekind-before-phase7.dump
docker compose down
```

For the separate private demo instead, while its database is running:

```powershell
docker compose --project-name tablekind-demo --env-file .env.demo -f compose.demo.yaml exec -T postgres pg_dump -U tablekind_demo -d tablekind_demo -Fc -f /tmp/before-phase7-demo.dump
docker compose --project-name tablekind-demo --env-file .env.demo -f compose.demo.yaml cp postgres:/tmp/before-phase7-demo.dump ..\tablekind-demo-before-phase7.dump
.\scripts\demo\Stop-Demo.ps1
```

Verify the backup files are present and nonempty. Preserve `.env.demo` privately with its database backup. Do not use `down --volumes`. Backup restoration testing itself belongs to Phase 7D; retaining a backup now protects the upgrade.

## Copy the source

Download `Tablekind_Phase7_ABC.zip` into `D:\Projects`. Extract to a fresh folder, then copy the contents of its `tablekind-spring` directory into your existing project:

```powershell
$phase7Extracted = "D:\Projects\Tablekind_Phase7_ABC_update"
Expand-Archive -LiteralPath "D:\Projects\Tablekind_Phase7_ABC.zip" -DestinationPath $phase7Extracted
$phase7Source = Join-Path $phase7Extracted "tablekind-spring"
Get-ChildItem -LiteralPath $phase7Source -Force | Copy-Item -Destination . -Recurse -Force
git --no-pager diff --stat
git diff --check
```

Run these from the existing project root. V4 adds settings/security tables. V1–V3 remain unchanged. Never edit an already-applied migration or remove it from a migrated installation.

## Native tests, then local review

```powershell
docker compose --profile test run --build --rm tests
```

Expected: 87 tests, no failures/errors/skips. This uses a dedicated test database. Three concurrency cases were skipped in the supplementary build environment; this local native run is required before migrating your working app. If it fails, keep the log and stop the update.

```powershell
docker compose up --build
```

Open `http://localhost:5173`. In a second window:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring\frontend"
npm ci
npx playwright install chromium
npm run test:browser
npm run test:pos
npm run test:phase7
npm run build
npm audit
```

Use `npm.cmd`/`npx.cmd` if the PowerShell script shim is blocked. No new native Build Tools are needed. Browser tests create fictional restaurants/accounts. `test:phase7` also enables MFA on its own disposable waiter account, not your manager account.

## What to look at together

1. Guest phone: scan, confirm the restaurant/table, join by nickname, see My order and Pay & split. Verify personal items and unpaid amount appear first. Expand All table items, Everyone's shares, advanced checkout and alternate split methods when needed.
2. Existing behavior: share a dish by consent, pay partly online and partly in cash, check change/tips and test a refund. TEST labels remain visible.
3. Waiter: sign in with a waiter account. Filter by branch or Needs attention; handle orders, assistance and payment collection. Setup/POS and reconciliation are manager-only.
4. Manager setup: create a fictional restaurant, branch, table, category, product and staff account. Use the checklist. Configure kitchen hours, guest ordering mode and menu languages.
5. Printed QR: generate/download/print a card. Before staff opens the table, it asks the guest to wait. After opening, it joins that exact session. Replace the printed code and verify the old one stops working. Print preview should contain only the card.
6. Pay-at-table: guest ordering is disabled; staff can enter orders and guests can still split/pay. No real external bill is imported yet.
7. Optional security: on a disposable account, enroll an authenticator, save recovery codes, sign back in and try a one-use recovery code. Change password and confirm old sign-ins stop working. Account and restaurant activity are accessible from their respective screens.

## Private phone demo

The separate demo scripts and Tailscale configuration are retained. Once the local review passes, rebuild the demo with the existing `Start-Demo.ps1` script and existing private environment file. Its database also receives V4. Follow START_DEMO.md / PRIVATE_DEMO.md for reconnecting and obtaining the URL. Keep access private.

For `npm run test:demo`, use the existing private-demo validation instructions and set TEST_APP_URL to the running demo. It remains a separate scenario because practice controls are unavailable in the ordinary local profile.

## Boundaries

This package covers 7A–C, with documented local test limitations. Phase 7D load/outage/restore/monitoring work, full app-interface translation, live POS/PSP/MIA/fiscal connections and hosting are not included. Menu translations are configurable; UI controls remain English. The usual POS remains the fallback for a future real pilot.

Preserve signing secrets: changing the JWT secret invalidates tokens/printed links and prevents decryption of existing MFA seeds. See PHASE7_SECURITY.md. No real credentials are included in the archive.

After your review passes, inspect and commit the changes on your branch. We can review Phase 7D together before starting it.
