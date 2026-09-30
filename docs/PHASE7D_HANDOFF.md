# Install and verify Phase 7D

Version 0.7.2. Exact source baseline: the uploaded `tablekind-spring.zip`, version 0.7.1 through Phase 7D. Read [RELIABILITY_CHECKPOINT.md](RELIABILITY_CHECKPOINT.md) and [RELIABILITY_VALIDATION.md](RELIABILITY_VALIDATION.md) for the changes and observed checks. No Git history or private settings are included. No public hosting or live payment/POS connection is added.

## 1. Preserve your working installation

Use normal PowerShell, with Docker Desktop running. Python 3.10 or newer is needed for the operational tools; your existing Python 3.12 is sufficient. No additional Python packages or Windows Build Tools are needed.

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring"
git branch --show-current
git status --short
py -3 --version
```

Stay on `phase-7-product-hardening`. If there are uncommitted changes, preserve/review them before copying this update. `git archive HEAD` backs up only committed code, not uncommitted work or databases.

Make a database backup BEFORE rebuilding the app (this uses the currently running database). These commands avoid PowerShell binary-output redirection:

```powershell
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U tablekind -d tablekind -Fc -f /tmp/before-phase7d.dump
docker compose cp postgres:/tmp/before-phase7d.dump ..\tablekind-before-phase7d.dump
docker compose down
```

Choose a different backup filename if that destination already exists. For a demo database you will update, back it up separately using the demo Compose project, user/database `tablekind_demo`, and your existing `.env.demo`, as described in PHASE7_HANDOFF.md. Keep `.env.demo` and the original signing secret privately alongside the backup. Never use `down --volumes` on these working stacks.

## 2. Copy the update

Save `Tablekind_0.7.2_source.zip` in `D:\Projects\Tablekind_SpringBoot_Phases_1-4`. Extract into a NEW directory, not over the working repository:

```powershell
$phase7dZip = "D:\Projects\Tablekind_SpringBoot_Phases_1-4\Tablekind_0.7.2_source.zip"
if (-not (Test-Path -LiteralPath $phase7dZip -PathType Leaf)) { throw "Download the ZIP to this path first." }
$phase7dFolder = Join-Path "D:\Projects" ("Tablekind_Phase7D_update_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
Expand-Archive -LiteralPath $phase7dZip -DestinationPath $phase7dFolder -ErrorAction Stop
$phase7dSource = Join-Path $phase7dFolder "tablekind-spring"
if (-not (Test-Path -LiteralPath (Join-Path $phase7dSource "START_PHASE7D.md"))) { throw "Unexpected archive contents; do not copy." }
Get-ChildItem -LiteralPath $phase7dSource -Force | Copy-Item -Destination "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring" -Recurse -Force
git diff --check
git --no-pager diff --stat
```

This reliability update adds no migration. V1–V5 are unchanged from the uploaded 0.7.1 archive. Do not modify old migrations or remove database volumes. Keep `.git`, `.env`, `.env.demo` and Tailscale state untouched. No environment files, including examples, are included in the source ZIP; preserve your existing private configuration.

## 3. Native backend and operational checks

From the working project root:

```powershell
docker compose --profile test run --build --rm tests
py -3 scripts\ops\test_tools.py
py -3 scripts\ops\review.py
```

Expected backend result for 0.7.2: **104 tests, zero failures/errors/skips**. This is an acceptance target, not an observed result. It includes nine new cases for waiter cancellation replay and the unconfigured payment boundary. Helper checks: **7 passed** here; run them again on Windows.

The operational review builds a separate, randomly named Docker project and database. It uses port **5281 on localhost**, not 8080/5173/5180. If 5281 is occupied, use `--port 5282`. It does not interrupt your ordinary app or Diego's demo. Allow several minutes for building and recovery.

Its default scenario checks five tables / twenty guests, 500 parallel reads (p95 budget 5 seconds), concurrent payment starts, duplicate requests, lost notification recovery, offline TEST POS catch-up, abrupt backend restart, database outage/readiness/recovery and a backup restored into another isolated database. Exact table-row digests are compared with the stopped source. See OPERATIONS.md for limits.

Success ends with `"status": "passed"` and `"nativeChaos": true`. The sanitized evidence is in `test-results\operations\<run>\result.json`. Review the measured latency too; this is a small local check, not a production capacity certification. Do not increase a failing latency budget just to get a green result.

Only disposable review containers/volumes are removed afterwards. Its backup is retained in ignored `backups\`; shared Docker images/build cache may remain. If any test fails, keep the result and terminal error and stop before marking the phase complete. Do not run broad Docker volume pruning to troubleshoot it.

## 4. Rebuild, inspect and run browser tests

Once the native checks pass:

```powershell
docker compose up -d --build --wait
```

Open `http://localhost:5173`. Sign in as a manager and select **System status**. This is not shown to waiters or guests. A restaurant with no POS can correctly have no active alerts; that does not mean a live connector is configured.

In the frontend directory:

```powershell
cd frontend
npm ci
npm run test:recovery
npx playwright install chromium
npm run test:operations
npm run test:browser
npm run test:pos
npm run test:phase7
npm run build
npm audit
cd ..
```

Use `npm.cmd` / `npx.cmd` if PowerShell blocks script shims. Browser tests add their own fictional restaurants and retain them for inspection. Existing custom manager credentials must be supplied through `TEST_STAFF_EMAIL` / `TEST_STAFF_PASSWORD`; tests do not reset your accounts. An MFA-protected primary manager needs a dedicated test account rather than disabling MFA.

Manual checks: the status screen fits on a phone, paused TEST POS produces an alert, and resuming clears it on refresh. Existing guest ordering, splitting, cash confirmation, onboarding and security settings should still work. Do not deliberately stop the database on a demo Diego is using; the isolated review covers outages.

## 5. Back up your updated data and prove restoration

With your ordinary database running:

```powershell
py -3 scripts\ops\backup.py --stack local
```

It prints a `.dump` path. Paste that exact path into:

```powershell
py -3 scripts\ops\restore_check.py --backup "D:\replace-with-the-printed-path.dump"
```

Keep the dump, adjacent checksum manifest and `.restore.json` report privately. This restore command creates a new temporary database; it never replaces your working database. Only restore backups you created/trust. It checks schema/financial consistency, not the availability of your separate signing/MFA secret or full application cutover. Keep a second private copy outside the PC.

For Diego's separate demo, rebuild with the existing `Start-Demo.ps1` after backing it up. Keep the existing secrets/Tailscale identity. Use `backup.py --stack demo` when that database is running. See PRIVATE_DEMO.md for the separate phone demo/browser scenario. No tailnet policy changes are required.

## 6. Review the update and retain evidence

Review source and the new native test reports. Keep dumps, `.env.demo`, access tokens and private logs outside any shared source package.

```powershell
git check-ignore -v .env.demo backups/
git status --short
git diff --check
git --no-pager diff --stat
```

Record the observed backend totals, browser results, outage review and restore report in the reliability validation document. Repository staging, commits, pushes, merges and deployment remain separate actions requiring an explicit request. This update performs none of them.
