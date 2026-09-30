# Publish the portfolio safely

## Chosen route

Create a new **tablekind-portfolio** repository from this reviewed source. Keep the original repository private. Do not copy its `.git` folder, merge its branches, import tags or force-push its history into the portfolio.

This route avoids publishing the original repository's commits, pull requests, issues, Actions logs, releases and private attachments. The new repository starts with a genuine portfolio publication commit. Earlier development and test evidence remain identified as historical records in the source.

No repository has been created, pushed or made public as part of preparing this package. No scanner can promise 100% absence of sensitive information. The source checks below are specific checks with documented limits.

## 1. Extract into a new directory

Download `Tablekind_Portfolio_Source.zip` to Downloads. Use a new PowerShell window:

```powershell
$zip = Join-Path $env:USERPROFILE 'Downloads\Tablekind_Portfolio_Source.zip'
if (-not (Test-Path -LiteralPath $zip)) { throw 'Download the reviewed ZIP first.' }
$portfolioRoot = Join-Path 'C:\Projects' ('Tablekind_Portfolio_' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $zip -DestinationPath $portfolioRoot -ErrorAction Stop
$portfolio = Join-Path $portfolioRoot 'tablekind-spring'
Set-Location -LiteralPath $portfolio
if (Test-Path .git) { throw 'This must be a fresh source directory without Git history.' }
py -3 scripts\security\review_source.py
if ($LASTEXITCODE -ne 0) { throw 'Source review blocked publication.' }
```

The source checker prints a list of binary assets requiring visual review. The supplied presentation screenshot contains only fictional, local website content. Open `docs/assets/presentation-preview.png` and the README before publication.

Do not copy your `.env`, `.env.demo`, databases, screenshots of logged-in sessions or other private working files here. Keep using the original folder for the existing private demo. Its generated settings are deliberately absent from this portfolio directory.

## 2. Sign in to GitHub and set a public commit identity

Install GitHub CLI if `gh --version` is unavailable:

```powershell
winget install --id GitHub.cli --exact --source winget
```

Reopen PowerShell after installing, return to the extracted source folder, and set `$portfolio = (Get-Location).Path` again. Then:

```powershell
gh auth login --hostname github.com --git-protocol https --web --scopes workflow
if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in failed.' }
gh auth setup-git
if ($LASTEXITCODE -ne 0) { throw 'Git credential setup failed.' }
$githubUser = gh api user --jq .login
if ($LASTEXITCODE -ne 0 -or $githubUser -ne 'Kazumi565') { throw 'Sign in to the intended GitHub account first.' }
$githubId = gh api user --jq .id
if ($LASTEXITCODE -ne 0) { throw 'Could not read the GitHub account ID.' }

$repo = 'Kazumi565/tablekind-portfolio'
git init --initial-branch=main
if ($LASTEXITCODE -ne 0) { throw 'Git initialization failed.' }
git config user.name 'Mihai Bargan'
git config user.email "${githubId}+${githubUser}@users.noreply.github.com"
git add --all
if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Fix the staged diff before continuing.' }
py -3 scripts\security\review_source.py --staged
if ($LASTEXITCODE -ne 0) { throw 'The Git index contains blocked files or private identifiers.' }
git diff --cached --stat
```

These identity settings apply only to the new local repository. They do not rewrite older commits in the original repository. No open-source license is selected automatically.

## 3. Run the secret scanner and native tests

Start Docker Desktop. Gitleaks scans locally in a container with no network and a read-only source mount. The image itself is downloaded by Docker before the container runs:

```powershell
$scanMount = "type=bind,source=$portfolio,target=/repo,readonly"
docker run --rm --network none --mount $scanMount `
    zricethezav/gitleaks:v8.30.1 dir /repo `
    --config /repo/.gitleaks.toml --redact=100 --no-banner
if ($LASTEXITCODE -ne 0) { throw 'Secret scan failed or found a candidate. Do not publish.' }

docker compose --project-name tablekind-portfolio-check --profile test run --build --rm tests
if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed. Inspect the test output.' }
```

The native test uses its own Compose project and test database. It does not start the normal local/demo application or change their databases. Backend execution was unavailable in the preparation environment and must not be claimed as rerun until this check or CI passes.

If a scanner flags a value, investigate it locally. Do not paste credential values into a chat or public issue. Rotate/revoke any real credential before considering publication. Do not suppress a whole directory to obtain a passing result.

## 4. Create the new repository as private

After the checks pass:

```powershell
git commit -m 'Publish Tablekind portfolio source and documentation'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }

gh repo create $repo --private --source . --remote origin --push `
    --description 'Java and React restaurant ordering prototype with exact bill allocation, idempotent commands and a durable TEST POS outbox.'
if ($LASTEXITCODE -ne 0) { throw 'Repository creation or initial push failed. Inspect the state before retrying.' }

gh repo edit $repo --add-topic java --add-topic spring-boot `
    --add-topic postgresql --add-topic react --add-topic typescript `
    --add-topic docker --add-topic portfolio --add-topic idempotency

gh run list --repo $repo --workflow ci.yml --branch main
gh run watch --repo $repo --exit-status
```

If the workflow is not listed yet, rerun the last two commands after a moment. The workflow performs source checks, frontend checks, native backend tests and presentation-site browser checks. It has read-only repository permissions and no deployment step.

Open the private repository and review its README, Files, Actions output and **Security** settings. The original private repository should still be private. Do not add the private Tailscale URL as the portfolio homepage.

## 5. Make only the new repository public

Use the same PowerShell session and folder. This gate requires a successful workflow for the exact current commit and refuses the original repository name:

```powershell
if ($repo -ne 'Kazumi565/tablekind-portfolio') { throw 'Unexpected repository. Stop.' }
$head = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the current commit.' }
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'The working tree must match the reviewed commit.' }
$runs = gh run list --repo $repo --workflow ci.yml --branch main --limit 20 `
    --json headSha,status,conclusion
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify CI status.' }
$passed = @(($runs | ConvertFrom-Json) | Where-Object {
    $_.headSha -eq $head -and $_.status -eq 'completed' -and $_.conclusion -eq 'success'
})
if ($passed.Count -eq 0) { throw 'No successful portfolio workflow exists for this commit.' }
$remoteHead = gh api "repos/$repo/commits/main" --jq .sha
if ($LASTEXITCODE -ne 0 -or $remoteHead -ne $head) { throw 'The remote main branch differs from the reviewed commit.' }
$review = Read-Host 'Type PUBLISH after reviewing the new private repository'
if ($review -cne 'PUBLISH') { throw 'Publication cancelled.' }

gh repo edit $repo --visibility public --accept-visibility-change-consequences
if ($LASTEXITCODE -ne 0) { throw 'Visibility change failed.' }
gh repo view $repo --json nameWithOwner,visibility,url
```

A GitHub visibility change publishes that repository's history and Actions logs. The separate repository is why the old business/development history stays private. Making a repository private again cannot recall copies already downloaded by others.

## 6. Enable repository protection

Once public:

```powershell
gh repo edit $repo --enable-secret-scanning --enable-secret-scanning-push-protection
if ($LASTEXITCODE -ne 0) { throw 'Enable Secret scanning and Push protection in repository Settings > Code security.' }
gh api --method PUT "repos/$repo/private-vulnerability-reporting"
if ($LASTEXITCODE -ne 0) { throw 'Enable Private vulnerability reporting in the repository Security settings.' }
gh repo view $repo --web
```

Review availability and the actual resulting settings. Pin the repository to your GitHub profile. A useful profile description is: **Restaurant ordering prototype with exact shared-bill accounting, idempotent APIs, a durable POS outbox and recovery tests.**

Publishing source does not publish the running application, purchase a domain, expose the private demo or activate real integrations.

## References

- [GitHub: repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub: removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [GitHub CLI: create](https://cli.github.com/manual/gh_repo_create), [edit](https://cli.github.com/manual/gh_repo_edit), [watch checks](https://cli.github.com/manual/gh_run_watch)
- [Gitleaks usage and configuration](https://github.com/gitleaks/gitleaks)
