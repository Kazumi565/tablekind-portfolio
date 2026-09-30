# Phase 10: anonymous table QR scanning

This 0.10.2 source archive starts from the supplied 0.9.1 baseline. Phase 10 adds the guest camera path, a required table-confirmation dialog and automatic movement to the join form; it does **not** introduce public hosting, live SMS/email, real payments, POS connections or real reservations. No migration was changed or added.

## Upgrade without losing your Windows installation

1. Confirm your existing 0.9.1 branch is committed, and back up the *existing* local and demo databases with `py -3 scripts\ops\backup.py --stack local` and `--stack demo` where applicable. Keep copies of the current source, private `.env.demo`, signing/MFA secrets, Compose volumes and Tailscale identity; none belong in the ZIP or Git. Never delete volumes to apply this release.
2. Inspect the source ZIP, then copy its `tablekind-spring` source tree onto your existing project directory `C:\Projects\Tablekind_SpringBoot_Phases_1-4\tablekind-spring`. Do not replace `.git`, `.env*`, database dumps, private keys, `backups`, `test-results` or Docker volumes. This ZIP has no `.git`, secrets, build artifacts or dependencies. On a separate branch, review `git status --short` before staging anything; no push or PR is required.
3. In the project directory, with Docker Desktop running, execute:

   ```powershell
   docker compose up -d postgres
   docker compose --profile test run --build --rm tests
   Set-Location frontend
   npm.cmd ci
   npm.cmd exec -- playwright install chromium
   npm.cmd run build
   npm.cmd run test:qr-code
   Set-Location ..
   docker compose up -d --build backend frontend
   ```

4. For the isolated camera browser check, use a working **local owner/manager** account (not a random email). Enter its password without printing it:

   ```powershell
   $env:TEST_APP_URL = 'http://localhost:5173'
   $env:TEST_STAFF_EMAIL = Read-Host 'Local manager email'
   $securePassword = Read-Host 'Local manager password' -AsSecureString
   $env:TEST_STAFF_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
   npm.cmd --prefix frontend run test:qr-camera
   Remove-Item Env:TEST_APP_URL, Env:TEST_STAFF_EMAIL, Env:TEST_STAFF_PASSWORD
   Remove-Variable securePassword
   ```

   This creates a **fictional** restaurant and table in the local test installation. It does not access real customer data or payments. Do not run it against a production restaurant or the private demo. If your local fixture is the unchanged default, its email is in `README.md`; otherwise use an existing owner/manager account.

5. Rebuild the **same named** demo using `scripts\demo\Start-Demo.ps1` and `Connect-Demo.ps1` with the existing private settings; follow [START_DEMO.md](START_DEMO.md). On the phone, use the Tailscale **HTTPS** address and an open demo table printed from that address, not a localhost QR. Test a supported browser's Scan table QR button, preview and nickname confirmation; then test a rejected code, camera permission denial, Stop camera and paste-link fallback. Check the existing eleven-step demo and unchanged Mailpit-only verification separately. Leave Tailscale Funnel off.

Detailed evidence boundaries and manual checks: [Phase 10 validation](docs/PHASE10_VALIDATION.md). Implementation details: [QR scanner](docs/PHASE10_QR_SCANNER.md).
