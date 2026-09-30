# Install and verify Phase 6A

Source version 0.6.0, based on starting commit `f19a27a37258f1287b4937995cb87fefa7d10fe1`. Use the existing repository on `phase-6-integrations`. This update contains no Git history or real credential file.

## 1. Check and back up

In normal PowerShell:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring"
git branch --show-current
git status --short
```

Confirm the branch is `phase-6-integrations` and the working tree is clean. Preserve any uncommitted work before copying. The source backup includes committed files only.

```powershell
git archive --format=zip --output="..\tablekind-before-phase-6.zip" HEAD
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U tablekind -d tablekind -Fc -f /tmp/tablekind-before-phase-6.dump
docker compose cp postgres:/tmp/tablekind-before-phase-6.dump ..\tablekind-before-phase-6.dump
docker compose down
```

Check that both backups exist and are not empty. Do not add `--volumes`.

## 2. Copy the source update

Place `Tablekind_Phase_6A.zip` at `D:\Projects\Tablekind_Phase_6A.zip`. Use a fresh extraction directory on D:

```powershell
$phase6Extracted = "D:\Projects\Tablekind_Phase_6A_update"
Expand-Archive -LiteralPath "D:\Projects\Tablekind_Phase_6A.zip" -DestinationPath $phase6Extracted
$phase6Source = Join-Path $phase6Extracted "tablekind-spring"
Get-ChildItem -LiteralPath $phase6Source -Force | Copy-Item -Destination . -Recurse -Force
git status --short
git --no-pager diff --stat
git diff --check
```

Run the copy command from your existing project root. The archive contains a `tablekind-spring` folder. It leaves `.git`, your private remote, local `.env`, database volume and installed dependencies in place. It adds V3; V1/V2 stay byte-for-byte unchanged.

## 3. Native backend gate

Before migrating the application's database:

```powershell
docker compose --profile test run --build --rm tests
```

Expected: 72 tests, zero failures/errors/skips. This includes 25 POS tests and the original 47 tests. The three concurrency tests must execute, not skip. The test service uses a separate PostgreSQL 16 database. Reports are in `test-results/backend`.

If this fails, stop and retain the log. Do not delete databases or edit V1/V2. A browser test does not substitute for native concurrency verification.

## 4. Start and review

```powershell
docker compose up --build
```

Flyway should validate V1/V2 and apply V3 once. Existing data should remain. Open http://localhost:5173 and follow the Phase 6 walkthrough in README.md.

It is easiest to create a new test restaurant before connecting the simulator. Connecting makes that restaurant's menu POS-managed. There is no disconnect/delete-queue control in this checkpoint. Pausing retains queued work.

In a second PowerShell window:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring\frontend"
npm ci
npx playwright install chromium
npm run test:browser
npm run test:pos
npm run build
npm audit
npm audit --omit=dev
```

If PowerShell blocks npm's script shim, use `npm.cmd` and `npx.cmd`. Do not reinstall native Build Tools; they are not needed for these dependencies.

The browser scenarios create their own fictional restaurants. Keep all orders and payments fictional.

## 5. Persistence check

1. Set TEST POS behavior to Offline and apply it.
2. Accept an order and confirm its message is waiting to retry.
3. Stop the app with Ctrl+C and `docker compose down` (without volumes).
4. Start again with `docker compose up --build`.
5. Confirm the same message ID and order still exist. Restore Online, then retry the same message if necessary.
6. Expect delivery and MATCH, without an extra kitchen order or payment.

This Docker restart check is required locally; it is not replaced by the simulated expired-lease test.

## 6. Commit after review

From the project root:

```powershell
git diff --check
git status --short
git add README.md backend frontend docs .gitattributes
git --no-pager diff --cached --stat
git --no-pager diff --cached
git commit -m "Add durable POS integration framework and recovery controls"
git push -u origin phase-6-integrations
```

Do not merge or tag until native tests and manual review are complete. Hosting and remote repository changes are not performed by this update.

## Recovery

Keep source and database backups together. Reverting source alone is not a database rollback. Do not remove V3 from an already-migrated database. Capture `docker compose ps` and `docker compose logs --tail=100 backend` for troubleshooting, without sharing real passwords or tokens.
