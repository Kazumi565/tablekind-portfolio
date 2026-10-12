# Manual review and publication

The intended branch is `hackathon/paypal-bill-splitting`; its original baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935` (`portfolio-before-paypal-ai`). Nine local commits preceded the menu redesign. Use the commands below to inspect the current count and any later commits or uncommitted edits; do not duplicate work that is already committed.

No GitHub push, remote merge, release or submission has been executed. The authorized [menu preview](https://tablekind-at-the-table.workspace-326781.chatgpt.site) is deployed on Sites with owner-private access; the full application remains local. Hosting authorization does not authorize a GitHub push. See [menu preview status](MENU-PREVIEW.md).

Run these commands from PowerShell. First review the branch, local commits, all changes since the baseline and any later uncommitted edits:

```powershell
Set-Location 'C:\Projects\Tablekind\Tablekind_Portfolio_20261001-011644\tablekind-spring'
git switch hackathon/paypal-bill-splitting
git status --short --branch
git rev-list --count portfolio-before-paypal-ai..HEAD
git log --oneline portfolio-before-paypal-ai..HEAD
git diff --stat portfolio-before-paypal-ai..HEAD
git diff portfolio-before-paypal-ai..HEAD
git diff
git diff --cached
```

`switch` selects the intended branch. `status` shows remaining work. `rev-list` counts commits since the original baseline, and `log` lists them. The baseline comparison reviews their combined contents. The last two commands show unstaged and staged edits made after those commits. None of these commands changes a remote.

If reviewed changes remain, stage the intended menu source, assets, tests and documents. This explicit path list includes the new photos and build scripts. Review the staged patch and scan its contents before committing:

```powershell
git add -- .gitignore README.md backend/src frontend/src frontend/tests frontend/scripts frontend/public/menu frontend/package.json frontend/package-lock.json frontend/.dockerignore frontend/index.html docs/hackathon
git diff --cached --check
git diff --cached
python scripts/security/review_source.py --staged
# Run only when staged changes exist and the review/checks pass:
git commit -m 'Polish the restaurant menu and preview'
```

`git add` stages the listed paths, including new files. `diff --cached --check` checks whitespace errors; `diff --cached` shows exactly what the next commit will contain. The Python command checks staged source for publication risks. `commit` saves the reviewed patch locally.

If the working tree is clean, skip the entire staging/commit block. Keep `.env.hackathon`, `ops-private/`, build output, screenshots with private data and provider credentials ignored. Never use `git add -f` for those files. The staged source checker is supplementary; inspect changes and rerun relevant tests for your edits. Catalog edits need `menu:sync` before `test:menu`, followed by both frontend builds; see [the menu workflow](MENU-PREVIEW.md#maintaining-the-catalog).

Only when ready to publish, **you** can run:

```powershell
git remote get-url origin
git push --set-upstream origin hackathon/paypal-bill-splitting
```

The first command should show `https://github.com/Kazumi565/tablekind-portfolio.git`. The push uploads the existing local commits and any additional commit you made, and sets upstream tracking for this branch. It does not merge into `main`, publish a release, upload the local baseline tag or submit to Devpost. No force push is needed. If Git reports remote changes, stop and inspect them before reconciling locally.

The baseline hash remains in the branch's history even without pushing the local tag. After pushing, verify the intended branch is accessible to judges, its MIT license is detected, and its setup links work. Complete the remaining [submission gates](CHECKLIST.md) before representing the entry as complete. A static menu preview alone does not provide the AI and payment journey.
