# Manual review and publication

The implementation agent is authorized to commit locally only. No push, remote merge, release, deployment or submission has been executed. The intended branch is `codex/paypal-ai-hackathon`; its original baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935` (`portfolio-before-paypal-ai`). Completed work is committed locally; do not create duplicate commits for those changes.

Run these commands from PowerShell. First review the branch, local commits, all changes since the baseline and any later uncommitted edits:

```powershell
Set-Location 'C:\Projects\Tablekind\Tablekind_Portfolio_20261001-011644\tablekind-spring'
git switch codex/paypal-ai-hackathon
git status --short --branch
git log --oneline portfolio-before-paypal-ai..HEAD
git diff --stat portfolio-before-paypal-ai..HEAD
git diff portfolio-before-paypal-ai..HEAD
git diff
git diff --cached
```

`switch` selects the intended branch. `status` shows remaining work. `log` lists commits already created locally; the baseline comparison reviews their combined contents. The last two commands show unstaged and staged edits made after those commits. None of these commands changes a remote.

If you make additional edits after review, stage only the intended paths (the example below includes the hackathon source, tests, setup and documents). Review the staged patch and scan its contents before committing:

```powershell
git add -- README.md LICENSE backend/src frontend/src frontend/tests frontend/package-lock.json compose.hackathon.yaml scripts/hackathon docs/hackathon
git diff --cached --check
git diff --cached
python scripts/security/review_source.py --staged
# Run only when staged changes exist and the review/checks pass:
git commit -m 'Finalize PayPal AI hackathon review changes'
```

If the working tree is clean, skip the entire staging/commit block. Keep `.env.hackathon`, test output, screenshots with private data and provider credentials ignored. Never use `git add -f` for those files. The staged source checker is supplementary; inspect changes and rerun relevant tests for your edits.

Only when ready to publish, **you** can run:

```powershell
git remote get-url origin
git push --set-upstream origin codex/paypal-ai-hackathon
```

The first command should show `https://github.com/Kazumi565/tablekind-portfolio.git`. The push uploads the existing local commits and any additional commit you made, and sets upstream tracking for this branch. It does not merge into `main`, publish a release, upload the local baseline tag or submit to Devpost. No force push is needed. If Git reports remote changes, stop and inspect them before reconciling locally.

The baseline hash remains in the branch's history even without pushing the local tag. After pushing, verify the intended branch is accessible to judges, its MIT license is detected, and its setup links work. Finish real integration checks and the remaining [submission gates](CHECKLIST.md) before representing the entry as complete.
