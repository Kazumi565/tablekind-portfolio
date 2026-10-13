# Manual review and publication

The intended branch is `hackathon/paypal-bill-splitting`; its original baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935` (`portfolio-before-paypal-ai`). Mihai already pushed the first **eleven commits**, through `b4bd14c`, which remains the last verified Render app commit. The twelfth local commit, `8c234fd`, records hosted verification. The thirteenth, `4247d99`, updates the menu and dinner interface. The fourteenth, `982d7a3`, consolidates duplicate menu dishes. The fifteenth, titled **Improve menu photos and dinner guidance**, adds corresponding dish photos, first-time guidance and non-spending AI availability. These four local commits await Mihai's push. Use the commands below to inspect the actual count and remaining edits; do not duplicate committed work.

The assistant has not pushed GitHub, merged remote branches or published releases. Mihai manually pushed the source and activated the [full Render app](https://tablekind-hackathon.onrender.com/). The latest interface is verified locally and needs a manual Render deployment after the push. The separate [Sites menu preview](https://tablekind-at-the-table.workspace-326781.chatgpt.site) remains owner-private and was not updated by this redesign. Video and Devpost submission remain unfinished. Hosting authorization does not authorize an assistant GitHub push.

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

If later interface or documentation edits remain after the fifteenth commit, stage the relevant paths explicitly, review and scan before committing:

```powershell
git add -- README.md backend/src/main/java/md/tablekind/ai backend/src/main/resources/demo/menu.json backend/src/test/java/md/tablekind/HackathonMenuTest.java backend/src/test/java/md/tablekind/AiAvailabilityTest.java backend/src/test/java/md/tablekind/AiAvailabilityHttpTest.java frontend/src frontend/public/menu frontend/scripts/sync-menu.mjs frontend/tests/menu-catalog.test.mjs frontend/tests/menu-photos.test.mjs frontend/tests/hackathon-guidance.test.mjs frontend/tests/ai-availability.test.mjs frontend/package.json docs/hackathon
git diff --cached --check
git diff --cached
python scripts/security/review_source.py --staged
# Only after review and checks pass, commit any remaining staged changes:
if (@(git diff --cached --name-only).Count -gt 0) {
    git commit -m 'Refine TableKind menu and dinner guidance'
}
```

`git add` stages the listed paths, including new files. `diff --cached --check` checks whitespace errors; `diff --cached` shows exactly what the next commit will contain. The Python command checks staged source for publication risks. The conditional `commit` saves a reviewed patch locally only when staged changes exist.

If the working tree is clean, skip the entire staging/commit block: the interface and verification documents are already committed locally. For edits outside those paths, review and add their explicit paths as well. Keep `.env.hackathon`, `ops-private/`, build output, screenshots with private data and provider credentials ignored. Never use `git add -f` for those files. The staged checker is supplementary; inspect changes and run checks relevant to later edits. Catalog edits need `menu:sync` before `test:menu`, followed by both frontend builds; see [the menu workflow](MENU-PREVIEW.md#maintaining-the-catalog).

Only when ready to publish, **you** can run:

```powershell
git remote get-url origin
git push --set-upstream origin hackathon/paypal-bill-splitting
```

The first command should show `https://github.com/Kazumi565/tablekind-portfolio.git`. The push uploads the four remaining local commits, plus any later reviewed commit; the eleven previously pushed commits are not duplicated. Upstream tracking is already configured; `--set-upstream` safely reaffirms it. The command does not merge into `main`, publish a release, upload the local baseline tag or submit to Devpost. No force push is needed. If Git reports remote changes, inspect them before reconciling locally.

The baseline hash remains in history without pushing the local tag. The earlier public app commit and MIT code license are already verified. Check permission for the newly included restaurant photographs separately before public distribution; attribution alone does not establish a licence. **This update requires backend and frontend redeployment**, including the new AI status endpoint. Render auto-deploys are off: after pushing, open the `tablekind-hackathon` service in Render, choose **Manual Deploy → Deploy latest commit**, and verify the deployed commit matches `git rev-parse HEAD`. Recheck photos, dinner switching, consent, availability messaging and guest reload on the public HTTPS origin. Keep paid AI disabled unless further usage has been approved. The separate Sites preview will not change when Render deploys. Complete [submission gates](CHECKLIST.md), including ongoing AI access, credential delivery, video and final judge walkthrough.
