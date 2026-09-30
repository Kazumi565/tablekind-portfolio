# Tablekind private phone demo

0.10.0 note: rebuilding the *same* named demo stack adds the guest camera button; the eleven-step guide, private tailnet identity and demo data remain. It does not create a public site or change the Tailscale URL. Keep `.env.demo`, volumes and Tailscale state out of the source ZIP. Print the table QR while viewing the management screen from the tailnet HTTPS address, not localhost; the guest scanner deliberately rejects links to another origin. Test on a second device. If the phone browser cannot decode in-page, open the link in its normal camera app or paste the link; neither route requires an account. The guest must explicitly confirm the table and nickname before joining.

The original 0.9.0 demo uses the backend, its isolated application database and normal
order/payment APIs with TEST payment and POS providers. Its ten-step walkthrough
creates a fresh restaurant, a connected TEST POS, a table and two guests. Switch
between Mihai, Diego, Waiter and Manager on one phone. Ordering, approval, sharing
by consent, simulated card/cash payment and POS comparison are followed by
management and optional account verification. Hide the guide to explore freely.
Starting again preserves the previous table and its financial history.

Local verification messages are captured in Mailpit at http://localhost:8026 on
the host PC. No real mailbox is contacted. Do not expose this inbox to phones.

## What you need tomorrow

- Docker Desktop running Linux containers on your Windows desktop.
- A Tailscale account for you and one for Diego, plus the Tailscale app on each phone. Ask Diego for the email he actually uses to sign in to Tailscale.
- Your desktop awake and connected while either of you uses the demo.

Nothing has been published or sent to Diego. No domain, AWS account, real payment credentials or repository access is needed for this setup. The source remains on your computer. Browsers receive the compiled frontend JavaScript as with any web app; private access cannot prevent an authorized viewer from inspecting that frontend or taking screenshots.

## 1. Apply the update

Use [WINDOWS_UPDATE_AND_GIT.md](WINDOWS_UPDATE_AND_GIT.md) for the current Phase 7D
to 0.9.0 update at `C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring`.
It preserves the existing Git history, source, private settings and database
volumes before applying the complete ZIP. GitHub is currently Phase 6; the guide
records Phase 7D and the tested update as separate commits on an update branch.

## 2. Start the isolated demo

From the project root, in ordinary PowerShell:

```powershell
.\scripts\demo\Start-Demo.ps1
.\scripts\demo\Show-DemoLogin.ps1
```

If Windows blocks the downloaded scripts, unblock only this reviewed set:

```powershell
Get-ChildItem .\scripts\demo\*.ps1 | Unblock-File
```

If script execution itself is disabled, use a session-only setting, then run the commands again:

```powershell
Set-ExecutionPolicy -Scope Process RemoteSigned
```

Open **http://localhost:5180** on your desktop. Sign in with the displayed demo email/password and press **Start practice table**. Keep the generated `.env.demo` file: later starts reuse it. Do not commit it, upload it, or send the whole file to Diego. Only share the demo staff email/password privately.

The first build downloads images and dependencies. Docker stores its images and database volumes in Docker Desktop's disk image, which might still be on C: even though the project is on D:. Check Docker Desktop's disk-image location if C: is tight before starting a new build.

The standalone `compose.demo.yaml` uses project `tablekind-demo`, a separate PostgreSQL volume and credentials, and a separate signing key. Its app host port is `127.0.0.1:5180`; the desktop-only email inbox is `127.0.0.1:8026`. The backend and database have no host ports. Your development project remains on 5173/8080 with its existing database. Do not combine the two compose files with multiple `-f` arguments.

## 3. Enable private HTTPS access

```powershell
.\scripts\demo\Connect-Demo.ps1
```

Open the login URL the command prints and approve the **tablekind-demo** device in your Tailscale account. If it asks to enable HTTPS certificates, open that settings link, enable HTTPS, and run the script again. Use the resulting full address, such as `https://tablekind-demo.your-tailnet.ts.net`.

The Tailscale client runs in a dedicated container alongside the demo web server. It shares neither your Windows desktop nor your source directory, advertises no subnet routes, and enables no SSH or exit node. HTTPS proxies only the web application. We use **Serve**, which is private to permitted Tailscale clients. Never enable **Funnel**, which would make the endpoint public. [Tailscale Serve documentation](https://tailscale.com/docs/reference/tailscale-cli/serve).

On your phone, install Tailscale, sign into your account, turn its connection on, then open that full HTTPS address in your normal browser. Using HTTPS also enables the browser features the app needs. A plain `http://192.168...` LAN URL is not the supported phone setup.

## 4. Restrict access and share with Diego

Use a dedicated demo tailnet if possible. This keeps its access rules simple. Check Tailscale's current account/plan terms for your startup use; this package does not assume a particular free plan.

Generate a policy using the actual sign-in emails:

```powershell
.\scripts\demo\Show-DemoAccess.ps1 -OwnerEmail "YOUR_TAILSCALE_EMAIL" -DiegoEmail "DIEGO_TAILSCALE_EMAIL"
```

For a **new dedicated demo tailnet**, copy the resulting JSON into its Tailscale Access controls policy editor, review its validation result and save. It allows only these identities to reach the demo node on TCP 443. Replace any default allow-everything policy in that dedicated network. Adding a narrow rule below a broad allow rule does not restrict that broader rule.

If you already have other devices or users in the tailnet, do not replace its policy with this template. We should review the existing rules together first; the template intentionally only covers this demo. No script changes your access policy automatically.

In the Tailscale Machines page, find **tablekind-demo**, choose **Share**, and send a single-use invitation to Diego. Share this device only, not your desktop or entire tailnet. After he accepts, verify the accepting account is the email used in the policy. Email delivery alone does not enforce that identity: Tailscale allows an emailed invitation to be accepted by another account. The explicit access rule is what restricts the account. [Tailscale machine sharing and access controls](https://tailscale.com/docs/features/sharing).

Diego installs Tailscale on his phone, signs into that account, enables its connection, and opens the full HTTPS address. He then uses the separate Tablekind demo login you send him. No GitHub access is involved. In this practice copy, the demo staff account can operate all restaurant controls; it is not a restricted customer account.

Before handing it over, test once on your phone using mobile data:

1. With Tailscale connected, the full HTTPS URL opens and the guide works.
2. With Tailscale disconnected, force-refresh the URL: it should fail to load. A page already in memory is not an access test.
3. Back on Tailscale, log in, start a practice table and follow all eleven steps.
4. Confirm Diego's accepted identity and that no broad policy rule grants other identities access.

## 5. What to try on the phone

Press **Open this step** to jump to the correct person and screen. Perform the action in the app below the guide, then press **Next**. The steps do not place orders or collect payments automatically.

Use one Shared pizza for the first run. Its price is 181.01 MDL, so an equal split produces 90.50 and 90.51 MDL. Which guest gets the extra ban is determined by the bill allocation, not by the guide. Pay one share through the TEST card checkout and the other through cash confirmed by staff. The remaining total should become zero.

On step 8, select the practice session in **POS table session**, wait for queued work to be delivered, then press **Compare POS bill**. Expect **MATCH**. The comparison proves consistency with the simulator; it does not prove real bank settlement or produce a fiscal receipt.

Under **Try more or start again**, start a fresh table for a new run. Reloading retains the practice roles and guide step in that browser tab. Signing out clears all those roles. Browser tabs keep separate practice contexts; Mihai and Diego can each start their own practice table without changing the other's table. A normal customer can still join a table through its QR/link, without the staff credentials or role-switching controls.

## Stop, resume or revoke access

Stop the entire demo and keep its data:

```powershell
.\scripts\demo\Stop-Demo.ps1
```

Start it again with `Start-Demo.ps1`, then `Connect-Demo.ps1`. Do not recreate `.env.demo` between runs. If the file is lost but a demo database already exists, startup deliberately stops: restore the file before continuing.

To disable remote HTTPS while leaving the desktop demo running:

```powershell
.\scripts\demo\Disconnect-Demo.ps1
```

To revoke Diego permanently, revoke his device share in Tailscale and remove his policy grant. Do not use `docker system prune`, delete development volumes, or run a blanket `tailscale serve reset` for this task.

## Verification on your Windows machine

After the demo starts, run its guided browser test in another PowerShell window:

```powershell
$demoSettings = Get-Content .env.demo | ConvertFrom-StringData
$env:TEST_STAFF_EMAIL = $demoSettings.DEMO_STAFF_EMAIL
$env:TEST_STAFF_PASSWORD = $demoSettings.DEMO_STAFF_PASSWORD
$env:TEST_APP_URL = 'http://localhost:5180'
$env:TEST_MAILPIT_URL = 'http://localhost:8026'
cd frontend
npm ci
npx playwright install chromium
npm run test:demo
Remove-Item Env:TEST_STAFF_EMAIL, Env:TEST_STAFF_PASSWORD, Env:TEST_APP_URL, Env:TEST_MAILPIT_URL
Remove-Variable demoSettings
```

This creates two practice tables and leaves them in the isolated demo history. Keep credentials out of screenshots/logs you send back. The browser test verifies the application flow; the phone checks above verify the private network and HTTPS on your devices.

Build and normal local browser/POS tests remain available as before. See `PHASE9_VALIDATION.md` for current results and pending environment checks. `PRIVATE_DEMO_VALIDATION.md` records historical evidence.

When you're satisfied, review the diff and commit the demo update on your own branch. No commits or pushes have been made for you.
