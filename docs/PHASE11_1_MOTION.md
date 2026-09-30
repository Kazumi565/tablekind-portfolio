# Public website 0.11.1: motion and interaction revision

Date: 25 September 2026. Exact input: the delivered `Tablekind_0.11.0_source.zip`, SHA-256 `9ff8c2df714d48a0e887a87caf35eddb87a631f84ed1a94dd302d15df58f88a8`.

The restaurant application remains 0.10.2. This revision changes the separate presentation website and its documentation only. There is no backend, database, migration, Compose or private-demo change. Nothing was deployed or pushed to GitHub.

## Implemented

- A scroll-linked opening: the phone straightens and moves aside while the join, sharing and total cards emerge in sequence and settle in a vertical column. Scrolling upwards reverses the sequence. The experience link provides a direct route past it.
- Pinning is limited to desktop layouts at least 1120 pixels wide and 780 pixels high, with a fine pointer and ordinary motion preferences. Small/touch screens use native scrolling; narrow layouts put the cards below the phone. There is no wheel/touch interception or automatic advance.
- Subtle pointer response, navigation progress, staggered section entrances, animated walkthrough panels, table-card hover effects and FAQ transitions. No continuous animation timer or added animation dependency.
- A local two/three/four-guest illustration. Fictional 120 MDL pizza shares are computed in integer bani, and the next receipt follows the chosen group size, including the fictional 35 MDL lemonade. No money or live restaurant is involved.
- Interactive guest, waiter and manager previews with native buttons, visible focus, pressed states and announced content. These are presentation examples, not access to the real interfaces.
- Reduced-motion support, including changing the preference while the page is open. Cards remain visible without scripting, and enhanced-only controls stay hidden until their handlers exist.
- Dedicated motion regression tests, including card separation, reverse scrolling, keyboard controls, exact sample totals, minimum desktop size, short viewports, mobile layouts, touch-only input and static fallback.

## Executed in this environment

| Check | Observed result |
| --- | --- |
| Static build | Passed; 15 allowlisted output files, no runtime dependencies |
| Node build/isolation tests | 8 passed, 0 failed/skipped |
| Existing website browser suite | 8 grouped checks passed in Chromium 153.0.8010.0 |
| Dedicated motion suite | 7 grouped checks passed in the same Chromium |
| Responsive browser coverage | Existing five-page suite: 320, 360, 390, 430, 768, 1024 and 1440 pixels. Additional motion checks: 1120×800, 1440×650, 1920×1080 and touch-only 1280×900 |
| Accessibility automation | Zero reported violations across the existing 14 page/state/viewport audits and expanded form check, plus 18 group-size/role combinations at 320 and 1440 pixels |
| Motion and input | Sequential reveal, upright non-overlapping end positions, reverse scrolling, pointer reset, anchor skip, keyboard activation and live reduced-motion changes passed |
| Isolation and privacy | No observed external requests, submissions, browser storage, cookies, script errors or CSP violations in the motion suite |
| Visual review | Desktop story start/middle/end, mobile page, sharing and role previews inspected |

The existing website suite also rechecks the enquiry composer, double clicks, clipboard fallback, no-JavaScript navigation and the fictional configured-mailbox path. No email was sent.

Sanitised results are under `docs/verification/phase11-1-*.json`. Each browser run writes its screenshots and results to ignored `website/test-results/`. Automated contrast checks retain incomplete findings for human review; zero reported violations is not an accessibility certification. The Chromium binary is supplied locally through `TABLEKIND_BROWSER_EXECUTABLE`, not included in source or installed as a project dependency.

## Not executed

Physical Android/iPhone use, Safari, Firefox, screen readers, low-end device performance and Windows execution of this revision remain owner checks. The restaurant backend, database, full private demo and its native tests were not rerun because their source is unchanged. Earlier app test results are not new executions.

Domain registration, hosting, real email delivery, SMS and production integrations remain unconfigured. Payment and POS connections in the existing app remain TEST simulators; reservations remain fictional. This revision does not activate any of them.

## Preview and check on Windows

Extract the new ZIP to a fresh folder first. Compare with any local website changes before copying source into the project. Preserve the existing repository and private configuration.

```powershell
$project = 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
Set-Location -LiteralPath $project
npm.cmd --prefix website run build
npm.cmd --prefix website run preview
```

Open **http://127.0.0.1:5190**. Stop an earlier preview with Ctrl+C before restarting. Refresh with Ctrl+F5 if a tab still displays old styles. Build and preview need no Docker, dependencies or PowerShell execution-policy change.

Optional repeatable checks, in a second terminal:

```powershell
Set-Location -LiteralPath 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring\website'
npm.cmd ci
npm.cmd exec -- playwright install chromium
npm.cmd test
npm.cmd run test:browser
npm.cmd run test:motion
```

Try the opening both ways with the mouse wheel, then enable reduced motion. Explore the sharing and role buttons using Tab, Enter and Space. Review an actual phone before publication. The presentation website and the existing Tailscale restaurant demo remain separate.
