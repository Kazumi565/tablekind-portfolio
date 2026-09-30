# Start here — Tablekind 0.9.1 practice pilot review

This archive is based on the uploaded `4ba5e8d` source. It is a source update for the existing local and isolated demo installations; it has **not** been installed on the Windows computer or deployed to a domain. Preserve `.git`, database volumes, backups, `.env.demo`, secrets and Tailscale state outside the archive. No Git push, merge or tag was performed.

Read the [one-page architecture](docs/PILOT_ARCHITECTURE_ONE_PAGE.md), [pilot evidence](docs/PILOT_EVIDENCE.md) for security and the competitor summary, [0.9.1 validation](docs/PHASE9_1_VALIDATION.md) for actual tests and Windows acceptance commands, and [possible version 10 hosting](docs/PHASE10_HOSTING_PLAN.md) for external email and optional SMS. Continue using `START_DEMO.md` for the existing private demo; rebuilding it with this version adds the reservation exercise and 11-step guide without replacing its database.

From a fresh manager-owned restaurant, **Restaurant setup → start** offers one-step first branch/table/menu setup, followed by staff creation and printable QR cards. The **pilot** tab has aggregate counts. Guests at a practice table can open **Try reservations**; managers review **Practice reservations**. Neither practice approval nor TEST settlement is a real booking or payment.

Run the native tests and private-demo checks before making a pilot claim. The post-migration aggregate starts from zero; historical operational events are not backfilled. Reprint QR cards using the actual address phones will open, not a localhost address.

## Apply this source ZIP to the existing Windows working tree

Preserve the existing Git repository and its current private `.env.demo`. First make the local and demo database backups with `py -3 scripts\ops\backup.py --stack local` and `py -3 scripts\ops\backup.py --stack demo` while those databases are running. Keep the backup dumps and their manifest files outside Git. The current commit is also your recoverable source snapshot. Stop if `git status --short` lists work you have not already saved.

From PowerShell, replace only `$archive` with the downloaded ZIP's path:

```powershell
$project = 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
$archive = 'C:\path\to\Tablekind_0.9.1_pilot_source.zip'
Set-Location -LiteralPath $project
git status --short
$stage = Join-Path $env:TEMP ('tablekind-091-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $archive -DestinationPath $stage
Get-ChildItem -LiteralPath (Join-Path $stage 'tablekind-spring') -Force |
    Copy-Item -Destination $project -Recurse -Force
git diff --check
git status --short
```

The ZIP has neither `.git` nor `.env.demo` nor database dumps or dependency folders. Do not delete your existing working directory or Docker volumes. Run the [native acceptance steps](docs/PHASE9_1_VALIDATION.md) next, then rebuild the **same** named demo with `START_DEMO.md`. Decide on a local commit or remote push only after reviewing your own tests; this archive performs neither action.
