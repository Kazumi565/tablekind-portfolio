# Start the private demo

After installing source 0.10.2, rebuild this same `tablekind-demo` Compose project and use its existing `.env.demo` and Tailscale identity. The walkthrough still has eleven steps; it now includes the optional QR camera scan with a required table-confirmation dialog, automatic movement to the join form and joined-table confirmation. The scenario and financial history remain separate from the development stack. See [START_PHASE10.md](START_PHASE10.md) for the new tests.

For the 0.9.1 update from an already installed 0.9.0 folder, follow [0.9.1 validation](docs/PHASE9_1_VALIDATION.md) and back up before rebuilding. The [older Windows update guide](docs/WINDOWS_UPDATE_AND_GIT.md) describes the historical Phase 7D to 0.9.0 move. Keep your existing demo credentials and Tailscale access policy.

1. Complete the update checks above. [docs/PRIVATE_DEMO.md](docs/PRIVATE_DEMO.md) contains the private-demo setup and access guide.
2. Start Docker Desktop, open PowerShell in the project root and run:

   ```powershell
   .\scripts\demo\Start-Demo.ps1
   .\scripts\demo\Show-DemoLogin.ps1
   ```

3. Open **http://localhost:5180**. Sign in with the demo credentials and press **Start practice table**. You can switch between Mihai, Diego, Waiter and Manager on the same screen.
4. For your phone, run:

   ```powershell
   .\scripts\demo\Connect-Demo.ps1
   ```

   Sign into Tailscale when prompted, enable HTTPS if requested, and install Tailscale on your phone. Open the full HTTPS URL shown by the command.
5. Before sharing with Diego, use the **Restrict access and share with Diego** instructions in the guide. You'll need the email he uses for Tailscale. The scripts prepare the connection; you control account access and invitations.

Your desktop needs to stay awake for this version of the demo. Payment and POS integrations are still simulations. The normal development database is separate. The eleven-step walkthrough includes an optional account with local verification and a practice reservation: read the email code at **http://localhost:8026** on the host desktop. No message reaches a real mailbox, and no real table is reserved.

To try camera joining, display an open demo table's printable QR on your desktop and open **/guest** on your phone using the same tailnet HTTPS address. Tap **Scan table QR**, grant camera permission, point at the desktop QR, check the restaurant and table, enter a nickname and tap **Join table**. Use a separate browser tab/device from the guided role-switching scenario. If this phone browser cannot decode a QR in-page, its normal camera app can open the printed link, or you can paste that link in **/guest**. QR codes generated from `localhost:5180` belong to a different origin and cannot be used on the tailnet: print the card from the tailnet address.

To stop only the demo:

```powershell
.\scripts\demo\Stop-Demo.ps1
```

If a command fails, keep the command and error text, without passwords or the `.env.demo` file.
