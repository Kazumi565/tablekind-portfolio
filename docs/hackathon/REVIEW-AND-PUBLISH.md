# Manual review and publication

The intended branch is `hackathon/paypal-bill-splitting`; its original baseline is `81dbdcf0e3517b8f917203ff69269f5530a26935` (`portfolio-before-paypal-ai`). On 28 October, local HEAD and the local remote-tracking ref both resolved to `b6a183e5f4446953ea385e910a1d8a1375b03038` (**Use GPT-6 Luna for bill split interpretation**). The menu and interface commits are already in that history. The Ink & Saffron theme and the prepared submission and verification documents remain uncommitted edits. No new local commit was created for the palette or video revision. Refresh the remote-tracking ref and inspect the actual state below rather than recreating commits that already exist.

The assistant has not pushed GitHub, merged remote branches or published releases. Mihai manually pushed the source and activated the [full Render app](https://tablekind-hackathon.onrender.com/). The recorded hosted app image is `414c060`, with Luna selected through its environment; its complete Luna journey passed on 16 October. Recheck the final public source and deploy the intended reviewed version before submission. The separate Sites menu preview is owner-private. Video publication, judge access delivery and Devpost submission remain unfinished. Hosting authorization does not authorize an assistant GitHub push.

Run these commands from PowerShell. First review the branch, local commits, all changes since the baseline and any later uncommitted edits:

```powershell
Set-Location 'C:\Projects\Tablekind\Tablekind_Portfolio_20261001-011644\tablekind-spring'
git switch hackathon/paypal-bill-splitting
git fetch origin
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

`switch` selects the intended branch. `status` shows remaining work. The first `log` and `diff` show local commits/contents beyond the local remote-tracking ref. `rev-list` counts commits since the original baseline; the following `log` and baseline comparison review all hackathon changes. The last two commands show unstaged and staged edits. None changes a remote. Run `git fetch origin` before these comparisons to refresh the remote-tracking ref if needed; fetching does not push or merge.

For the palette and prepared documentation update, stage these reviewed paths, then inspect and scan the staged result:

```powershell
git add -- README.md docs/hackathon frontend/src
git diff --cached --check
git diff --cached
python scripts/security/review_source.py --staged
# Only after review and checks pass, commit any remaining staged changes:
if (@(git diff --cached --name-only).Count -gt 0) {
    git commit -m 'Apply Ink and Saffron theme and prepare submission materials'
}
```

`git add` stages the listed paths, including new files. `diff --cached --check` checks whitespace errors; `diff --cached` shows exactly what the next commit will contain. The Python command checks staged source for publication risks. The conditional `commit` saves a reviewed patch locally only when staged changes exist.

If the working tree is clean, skip the staging/commit block. For edits outside those paths, review and add their explicit paths separately. Keep `.env.hackathon`, `ops-private/`, video source/output, build output, screenshots with private data and provider credentials ignored. Never use `git add -f` for those files. The staged checker is supplementary; inspect changes and run checks relevant to later edits. Documentation-only changes do not require paid AI calls or payment tests.

Only when ready to publish, **you** can run:

```powershell
git remote get-url origin
git push --set-upstream origin hackathon/paypal-bill-splitting
```

The first command should show `https://github.com/Kazumi565/tablekind-portfolio.git`. The push uploads commits missing from the remote, including the newly reviewed documentation commit; it does not duplicate existing commits. Upstream tracking is already configured; `--set-upstream` safely reaffirms it. The command does not merge into `main`, publish a release, upload the local baseline tag or submit to Devpost. No force push is needed. If Git reports remote changes, inspect them before reconciling locally.

The baseline hash remains in history without pushing the local tag. The unlicensed restaurant menu photographs have been replaced locally with licensed representative Commons photos. Include all frontend/public/menu replacements, the photo-credits page and MENU-PHOTOS.json when publishing; retain each image licence separately from MIT. Verify the deployed assets after publication. The palette passed the frontend production build; run `npm --prefix frontend run build` again after any further code edits. The hosted source version should be aligned with the reviewed branch. Render auto-deploys are off: after pushing, choose **Manual Deploy → Deploy latest commit** for `tablekind-hackathon`, then verify the deployed commit against `git rev-parse HEAD`. Preserve the existing database and approved AI environment. A Blueprint sync can reapply the checked-in disabled/zero AI defaults, so inspect configuration changes before syncing. Recheck the [judge instructions](JUDGE-GUIDE.md) on the public HTTPS origin. The separate Sites preview will not change. Complete [submission gates](CHECKLIST.md), including controlled access, budget monitoring, video and the final access-package walkthrough.
