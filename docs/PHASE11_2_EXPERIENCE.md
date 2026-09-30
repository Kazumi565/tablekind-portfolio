# Public website 0.11.2: an interactive evening

Date: 26 September 2026. Exact baseline: `Tablekind_0.11.1_source.zip`, SHA-256 `abdf85a86763d1a4006bc85b56776de3eb5a46a9312fa201c5179c84862e1f8b`.

This revision improves the separate presentation website. The restaurant app stays at 0.10.2. Backend, operational frontend, migrations, Compose configuration and private-demo scripts are identical to the delivered baseline. No repository mutation or public deployment was performed.

## Implemented

- A fictional menu with three illustrated shared dishes. Visitors choose Margherita, grilled vegetables or chocolate cake, set two/three/four guests and decide whether to include their own lemonade.
- Immediate personal totals and a matching itemised receipt. Shared food is divided using integer bani. The three fixed prices divide exactly for the supported guest counts. The optional personal drink affects only the visitor's example total. Everyone's agreement is an explicit assumption of the illustration, not a real consent action.
- Buttons to continue through the example, change the combination and reset to the original three-person pizza example. New content receives keyboard focus, and a concise status region announces updated amounts.
- Compact Join/Share/Your bill controls on narrow screens. Desktop instructions remain alongside the interactive example while it is explored.
- A native mobile navigation disclosure on all five pages. It supports keyboard activation, Escape, outside-click closure, focus exit, section links and resizing. Its links also work without JavaScript.
- Larger illustrated guest/waiter/manager workspaces, with clearly fictional sample rows, smoother selection transitions and more readable mobile controls.
- The 0.11.1 opening scroll sequence, pointer response, reverse scrolling and reduced-motion support are preserved. No animation or runtime package dependency was added.

The presentation example creates no real order, reservation, customer account or payment. It makes no API request and persists no selection. Refreshing resets it. The hero phone and separate role preview remain independent fictional illustrations, not views of a connected restaurant session.

## Validation scope

The dedicated experience suite checks all 18 dish/group-size/drink combinations against the displayed individual amounts and receipt. It also checks keyboard use, repeated clicks, reset, mobile menu behaviour, responsive layouts and static fallback. The existing build, website-browser and motion suites cover their previous flows again.

Observed current results are stored in `docs/verification/phase11-2-*.json`. The delivery records only completed runs; older 0.11.0/0.11.1 evidence is retained separately as history.

| Check | Observed result |
| --- | --- |
| Static build | Passed; 17 allowlisted files, no runtime package dependencies |
| Node build/isolation tests | 8 passed, 0 failed/skipped |
| Website browser suite | 8 grouped checks passed in Chromium 153.0.8010.0 |
| Motion browser suite | 7 grouped checks passed in the same Chromium |
| Experience browser suite | 6 grouped checks passed, including all 18 fictional combinations |
| Responsive coverage | Existing five-page suite at 320/360/390/430/768/1024/1440 pixels; new expanded examples and workspaces at 320/390/768/1024/1440; native mobile menus on five pages at 320/390/768 |
| Accessibility automation | Zero reported violations in 14 existing page/state audits plus the expanded form check, 18 motion/role audits and 5 new experience/menu audits |
| Static safety | No observed script/CSP errors, external requests, submissions, cookies or browser storage in the browser suites |
| Visual inspection | Desktop and mobile walkthrough, receipt, role workspace and mobile menu reviewed |

Accessibility scans run after finite entrance transitions finish. Incomplete contrast findings remain in the evidence for human review. Automated checks and emulated viewports do not certify accessibility or physical-device performance. Browser execution uses the locally available Chromium binary through `TABLEKIND_BROWSER_EXECUTABLE`; that binary is not a dependency or source deliverable.

Physical phones, Safari, Firefox, screen readers and Windows execution of this revision remain owner checks. Native backend/PostgreSQL, the operational app and Tailscale demo were not rerun because their source is unchanged. Domain, hosting and actual email delivery were not tested or activated. Payments/POS stay TEST simulators, reservations stay fictional, and SMS stays disabled.

## Review on Windows

Extract the source ZIP to a fresh folder first. Compare with any local website edits before copying. Preserve the repository and private configuration. Stop an earlier website preview with Ctrl+C, then run:

```powershell
Set-Location -LiteralPath 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring'
npm.cmd --prefix website run build
npm.cmd --prefix website run preview
```

Open **http://127.0.0.1:5190** and refresh with Ctrl+F5. Build/preview need no Docker or installed dependencies. No PowerShell policy change is needed. The existing restaurant/demo ports are not affected.

Try the food choices, group size and lemonade option, continue to the bill and reset the example. Check the mobile Menu, compact steps and all role previews. Use Tab, Enter and Space, and enable reduced motion for a second pass.

To repeat the automated checks in another terminal:

```powershell
Set-Location -LiteralPath 'C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring\website'
npm.cmd ci
npm.cmd exec -- playwright install chromium
npm.cmd test
npm.cmd run test:browser
npm.cmd run test:motion
npm.cmd run test:experience
```

Runtime results and screenshots go to ignored `website/test-results/`. This release introduces no additional hosting or email setup requirement. The existing public-configuration review and guarded release build still apply before any future publication.
