# Install the phase 5 update

This is a source update for your existing private project. It contains no Git history, credentials, node_modules or build output. Keep your existing repository folder and its .git directory. Do not push changes until you have reviewed and tested them.

## 1. Check and back up the existing project

In normal PowerShell:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring"
git branch --show-current
git status
```

Use your `phase-5-payments` branch. If needed, run `git switch phase-5-payments`. If git status shows your own uncommitted work, save it before copying this update. The source backup below includes committed files only.

```powershell
git archive --format=zip --output="..\tablekind-before-phase-5.zip" HEAD
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U tablekind -d tablekind -Fc -f /tmp/tablekind-before-phase-5.dump
docker compose cp postgres:/tmp/tablekind-before-phase-5.dump ..\tablekind-before-phase-5.dump
docker compose down
```

Check that both backup files exist in the parent folder. The database dump is outside the repository. Do not run `docker compose down --volumes`.

## 2. Extract and copy the update

Assuming the downloaded file is in Downloads:

```powershell
$phase5Archive = "$env:USERPROFILE\Downloads\Tablekind_Phase_5.zip"
$phase5Extracted = "$env:USERPROFILE\Downloads\Tablekind_Phase_5"
Expand-Archive -LiteralPath $phase5Archive -DestinationPath $phase5Extracted -Force
$phase5Source = Join-Path $phase5Extracted "tablekind-spring"
Get-ChildItem -LiteralPath $phase5Source -Force | Copy-Item -Destination . -Recurse -Force
git status --short
git diff --stat
git diff --check
```

Adjust the download path if your browser saved the ZIP elsewhere. Run Copy-Item from your existing project folder. The ZIP does not contain .git or .env, so your repository identity, remote and local environment file remain in place. Your existing V1 migration is byte-for-byte unchanged; V2 is a new file.

The earlier Java files were consistently formatted during review, so some diffs are formatting only. The functional addition is the payments package, V2, the payment UI, and related tests/docs.

## 3. Verify with PostgreSQL 16

Run this before migrating your app database:

```powershell
docker compose --profile test run --build --rm tests
```

Expect BUILD SUCCESS with no failed tests. Native concurrency tests should run rather than skip. Reports are in test-results/backend. If it fails, keep the output and send it for review before proceeding.

Then start the application:

```powershell
docker compose up --build
```

Flyway should validate V1 and apply V2 once. Existing restaurant data should remain. Open http://localhost:5173 and follow docs/REVIEW.md. Keep all payment testing fictional.

For the automated browser scenario, open a second PowerShell window:

```powershell
cd "D:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring\frontend"
npm ci
npx playwright install chromium
npm run test:browser
```

## 4. Save the reviewed change to your private branch

From the project root, after tests and your review:

```powershell
git diff --check
git status --short
git add README.md backend frontend docs compose.yaml scripts .env.example .gitignore .gitattributes
git diff --cached --stat
git diff --cached
git commit -m "Add payment attempts, mixed settlement and refunds"
git push -u origin phase-5-payments
```

Review the staged diff before committing. Build caches and test-results are ignored. Keep your normal Git author configuration. These commands push only your working branch; merging into main is a separate review step.

## If something goes wrong

Capture `docker compose ps`, `docker compose logs --tail=100 backend` and the failing test summary. Do not share real passwords or bearer tokens.

Do not remove V2 from an already-migrated database or edit it after application. Restoring the old source alone is not a database rollback. Keep the dump and source backup together and arrange a deliberate restore if needed.
