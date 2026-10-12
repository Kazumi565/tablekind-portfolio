# Manual review and publication

The intended branch is `hackathon/paypal-bill-splitting`; its original baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935` (`portfolio-before-paypal-ai`). Mihai already pushed the first **eleven commits**, through `b4bd14c`, and Render runs that app commit. A twelfth local commit records hosted verification and updates the documentation. Use the commands below to inspect the actual current count and remaining edits; do not duplicate committed work.

The assistant has not pushed GitHub, merged remote branches or published releases. Mihai manually pushed the source and activated the [full Render app](https://tablekind-hackathon.onrender.com/). The separate [Sites menu preview](https://tablekind-at-the-table.workspace-326781.chatgpt.site) remains owner-private. Video and Devpost submission remain unfinished. Hosting authorization does not authorize an assistant GitHub push.

Run these commands from PowerShell. First review the branch, local commits, all changes since the baseline and any later uncommitted edits:

```powershell
Set-Location 'C:\Projects\Tablekind\Tablekind_Portfolio_20261001-011644\tablekind-spring'
git switch hackathon/paypal-bill-splitting
git status --short --branch
git log --oneline origin/hackathon/paypal-bill-splitting..HEAD
git diff origin/hackathon/paypal-bill-splitting..HEAD
git rev-list --count portfolio-before-paypal-ai..HEAD
git log --oneline portfolio-before-paypal-ai..HEAD
git diff --stat portfolio-before-paypal-ai..HEAD
git diff portfolio-before-paypal-ai..HEAD
git diff
git diff --cached
```

`switch` selects the intended branch. `status` shows remaining work. The first `log` and `diff` show local commits/contents beyond the previously pushed branch. `rev-list` counts commits since the original baseline; the following `log` and baseline comparison review all hackathon changes. The last two commands show unstaged and staged edits. None changes a remote. The local remote-tracking ref currently points to `b4bd14c`; run `git fetch origin` first if you need to refresh it after another person's remote changes.

If additional **documentation** edits remain after the twelfth commit, stage them explicitly, review and scan before committing:

```powershell
git add -- README.md docs/hackathon
git diff --cached --check
git diff --cached
python scripts/security/review_source.py --staged
# Run only when staged changes exist and the review/checks pass:
git commit -m 'Update hosted demo instructions'
```

`git add` stages the listed paths, including new files. `diff --cached --check` checks whitespace errors; `diff --cached` shows exactly what the next commit will contain. The Python command checks staged source for publication risks. `commit` saves the reviewed patch locally.

If the working tree is clean, skip the entire staging/commit block: the verification documents are already in the twelfth local commit. For later code or asset edits, review and add their explicit paths as well. Keep `.env.hackathon`, `ops-private/`, build output, screenshots with private data and provider credentials ignored. Never use `git add -f` for those files. The staged checker is supplementary; inspect changes and run checks relevant to later edits. Catalog edits need `menu:sync` before `test:menu`, followed by both frontend builds; see [the menu workflow](MENU-PREVIEW.md#maintaining-the-catalog).

Only when ready to publish, **you** can run:

```powershell
git remote get-url origin
git push --set-upstream origin hackathon/paypal-bill-splitting
```

The first command should show `https://github.com/Kazumi565/tablekind-portfolio.git`. The push uploads the remaining local commit(s); the eleven previously pushed commits are not duplicated. Upstream tracking is already configured; `--set-upstream` safely reaffirms it. The command does not merge into `main`, publish a release, upload the local baseline tag or submit to Devpost. No force push is needed. If Git reports remote changes, inspect them before reconciling locally.

The baseline hash remains in history without pushing the local tag. The public app commit and MIT license are already verified. After pushing the documentation, verify the updated setup links. **A documentation-only push needs no app redeployment**; Render auto-deploys are off and the tested app remains `b4bd14c`. Complete [submission gates](CHECKLIST.md), including ongoing AI access, credential delivery, video and final judge walkthrough.
