# Update Mihai's Windows project and commit cleanly

Current source on the new SSD is Phase 7D. GitHub is still Phase 6. The project is:

`C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring`

The 0.9.0 ZIP is a complete source update including 0.7.2 reliability fixes,
Phase 8 interfaces/accounts and Phase 9 local email/demo/UI changes. Do not install
0.7.2 and 0.8.0 separately. Keep the existing project and Git repository. The old
folder name does not affect the application; there is no need to rename it now.

Run these blocks in the same ordinary PowerShell window, in order. Stop on any
unexpected error. Commands have been prepared and reviewed here, but have not
been executed on your Windows PC. No GitHub changes were made while preparing
this release.

## 1. Confirm the migrated tools and repository

```powershell
$project = 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
Set-Location -LiteralPath $project
git --version
docker version
docker compose version
node --version
npm.cmd --version
py -3 --version
git rev-parse --show-toplevel
git status --short
git branch --show-current
git remote -v
```

Expect Docker Desktop to be reachable and Node 22.12+ (Node 24 recommended).
Docker builds Java 21, so a host JDK is optional for this route. Verify the Git
root is the existing project repository. If Git reports that this is not a
repository, restore the original `.git` directory from the SSD migration backup
before continuing. Do not run `git init` or overwrite the folder with a clone.

Review existing changes and staged files locally. If files are already staged,
record what they are before continuing; the checkpoint below commits staged
source. Do not paste private environment values or remote access tokens into chat.

## 2. Back up before copying new source

Use a private backup location outside the repository. Back up the databases with
the existing Phase 7D tools, while still on the old source:

```powershell
py -3 scripts\ops\backup.py --stack local
```

If you use the separate demo, also run:

```powershell
py -3 scripts\ops\backup.py --stack demo
```

These require the corresponding PostgreSQL container to be running. If it is
stopped, start only its database using the old source:

```powershell
docker compose up -d postgres
# Separate demo, only if you already use it and preserved .env.demo:
docker compose --env-file .env.demo -f compose.demo.yaml up -d postgres
```

Then rerun the relevant backup command. Keep the printed dumps/checksums private
and copy them to your private backup location. Preserve your existing environment
files and signing/MFA secrets privately as well. They are not included in the ZIP
and must not go into Git. Do not generate replacement demo secrets for an existing
database. If the migrated database/volumes are missing, restore them before the
upgrade; a new empty database is not proof that the migration succeeded.

Make a source backup without generated directories or private files:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupSource = "C:\Projects\Tablekind_Backups\Phase7D-source-$stamp"
robocopy $project $backupSource /E /XD .git node_modules target dist test-results playwright-report backups ops-private .idea __pycache__ /XF .env .env.* *.dump *.log *.pem *.key *.p12 *.pfx
if ($LASTEXITCODE -ge 8) { throw 'Source backup failed. Stop here.' }
```

This source copy does not replace the private database/secrets backup. Never use
`docker compose down -v`, delete volumes or reset the existing Git repository.

## 3. Extract the update separately and checkpoint Phase 7D

Download `Tablekind_0.9.0_source.zip` into your Downloads folder. If the browser
renamed it, adjust only `$zip` below. Extract into a fresh staging folder:

```powershell
$zip = Join-Path $env:USERPROFILE 'Downloads\Tablekind_0.9.0_source.zip'
$staging = "C:\Projects\Tablekind_Updates\0.9.0-$stamp"
Expand-Archive -LiteralPath $zip -DestinationPath $staging
$source = Join-Path $staging 'tablekind-spring'
if (-not (Test-Path (Join-Path $source 'START_PHASE9.md'))) { throw 'Wrong archive or extraction path.' }
$sourceFiles = Get-ChildItem -LiteralPath $source -File -Recurse -Force | ForEach-Object {
    $_.FullName.Substring($source.Length + 1).Replace('\', '/')
}
```

The clean archive gives us a source-file list for staging. This avoids staging
your installed dependencies, runtime settings, dumps and unrelated files.

```powershell
Set-Location -LiteralPath $project
git switch -c update/tablekind-0.9.0
if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed. Review the current branch before proceeding.' }

# Stage only current files that correspond to source paths in the clean ZIP.
foreach ($relative in $sourceFiles) {
    if (Test-Path -LiteralPath (Join-Path $project $relative) -PathType Leaf) {
        git add -- $relative
        if ($LASTEXITCODE -ne 0) { throw "Could not stage $relative" }
    }
}
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
```

Review the staged source before committing. The archive list cannot audit the
contents of your old files or files you staged earlier. Ensure the list contains
no private environment files, credentials, database dumps, build output or
unrelated personal files. If any such file was already tracked, stop and remove
it from tracking while preserving its private local copy before pushing. Do not
force-add ignored paths. Handle any intentional source deletions shown by
`git status` explicitly after review.

If there are staged Phase 7 changes, commit the old source now:

```powershell
git commit -m "Checkpoint Phase 7D source before account and email update"
if ($LASTEXITCODE -ne 0) { throw 'Checkpoint commit failed. Stop before copying.' }
```

If there were no changes to commit, skip that command. This commit records the
existing implementation; it does not claim that native Phase 7D tests passed.
The next commit will contain the reviewed 0.9.0 update, so GitHub's Phase 6 history
remains followed by two understandable development checkpoints.

## 4. Copy the new source over the existing project

```powershell
robocopy $source $project /E /XD .git node_modules target dist test-results playwright-report backups ops-private /XF .env .env.* *.dump *.log *.pem *.key *.p12 *.pfx
if ($LASTEXITCODE -ge 8) { throw 'Source update failed. Stop and inspect the copy output.' }
Set-Location -LiteralPath $project
git status --short
git diff --stat
```

Use `/E`, never `/MIR` or `/PURGE`. The copy preserves `.git`, private settings and
existing data. V6 and V7 will be applied when the new backend starts. V1–V5 from
your Phase 7D project are unchanged. Do not edit old migrations if Flyway rejects
an upgrade; preserve the error and investigate the mismatch.

## 5. Test before committing the update

First use the separate disposable test database:

```powershell
docker compose --profile test run --build --rm tests
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed. Do not commit the update as validated.' }
py -3 scripts\ops\test_tools.py
if ($LASTEXITCODE -ne 0) { throw 'Operations tool checks failed.' }
```

Expected native backend result: 140 tests, zero failures/errors/skips. Review
`test-results\backend`. Supplementary results from this release do not replace
this native gate.

Then start the updated local stack and test the UI:

```powershell
docker compose up -d --build --wait
if ($LASTEXITCODE -ne 0) { throw 'The local stack did not become healthy.' }
docker compose ps
Set-Location (Join-Path $project 'frontend')
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npx.cmd playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed.' }
foreach ($task in @('build', 'test:recovery', 'test:email', 'test:accounts', 'test:browser', 'test:pos', 'test:phase7', 'test:operations')) {
    npm.cmd run $task
    if ($LASTEXITCODE -ne 0) { throw "Failed: $task. Stop and inspect its result." }
}
Set-Location -LiteralPath $project
```

Defaults target the fictional local bootstrap account. If your local test-manager
credentials differ, set TEST_STAFF_EMAIL/TEST_STAFF_PASSWORD privately before
running browser tests; do not include them in source, commits or screenshots.
Do not disable your personal MFA for automated tests. Results are under
`frontend\test-results`. Browser fixtures create fictional restaurants.

Open http://localhost:5173 and http://localhost:8025. Check all four interfaces,
anonymous joining, optional signup, email verification and password recovery.
Admin sign-in is separate and private. If you have never provisioned your sole
platform administrator, follow PHASE8_HANDOFF.md section 4 after these builds.
Do not attempt to register it from the customer signup page.

For full Phase 7D operational acceptance, run the disposable outage/restore
review from OPERATIONS.md. It is separate from the quick browser/build checks:

```powershell
py -3 scripts\ops\review.py
```

Require the review's passing status and `nativeChaos: true`. Also follow the
isolated restore procedure for your actual private backup and original secrets.
Do not claim deployment readiness solely from a passing source build.

## 6. Rebuild the private demo

If you use the private demo, from the project root:

```powershell
.\scripts\demo\Start-Demo.ps1
.\scripts\demo\Connect-Demo.ps1
```

Keep the existing `.env.demo` and Tailscale state. Desktop demo is
http://localhost:5180, and its private desktop inbox is http://localhost:8026.
Read email codes on the host PC; do not expose Mailpit through Tailscale or a
public route. Walk through all ten steps using TEST amounts only.

PHASE9_HANDOFF.md includes the automated demo browser command/settings. Test
private access from your phone and confirm the inbox is inaccessible there.
No real POS, payment, bank, MIA, terminal, fiscal or email service is connected.

## 7. Commit the tested update and push the branch

Record the results actually observed on your PC in PHASE9_VALIDATION.md. Include
failures or remaining gates accurately. Then stage only source again:

```powershell
Set-Location -LiteralPath $project
foreach ($relative in $sourceFiles) {
    if (Test-Path -LiteralPath (Join-Path $project $relative) -PathType Leaf) {
        git add -- $relative
        if ($LASTEXITCODE -ne 0) { throw "Could not stage $relative" }
    }
}
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
```

Review this second diff, then commit:

```powershell
git commit -m "Add role interfaces, optional accounts and local email demo"
if ($LASTEXITCODE -ne 0) { throw 'Update commit failed.' }
git log --oneline -3
git status --short
```

When you are satisfied with the commits and have confirmed `origin` is your
existing GitHub repository, push the new branch:

```powershell
git push -u origin update/tablekind-0.9.0
```

If your remote has a different name, use the verified name from step 1. Never
force-push. A rejected push is a reason to inspect the remote history, not to
reset your work. On GitHub, open a pull request from this branch to the existing
default branch. Review its changed files and test results before deciding to
merge. Do not merge or replace the default branch just to make the versions match.
