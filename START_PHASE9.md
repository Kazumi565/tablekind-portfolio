# Start here â€” Tablekind 0.9.0

This update adds local email verification and password recovery, a ten-step
private demo, and simpler screens across guest, waiter, management and platform
administration. It continues the saved 0.8.0 source; earlier migrations remain
unchanged. V7 is the only new migration.

No domain, email-service account or external credentials are needed. Messages
are captured in Mailpit on your computer. They do not reach real mailboxes and
do not prove ownership of a real email address. No SMS provider is configured.
All payment and POS flows remain TEST simulators.

The Windows working tree has now been updated from Phase 7D to Tablekind 0.9.0. For the complete copy, test and
Git workflow at its new SSD path, start with
[`docs/WINDOWS_UPDATE_AND_GIT.md`](docs/WINDOWS_UPDATE_AND_GIT.md).

Read:

1. `docs/PHASE9_CHECKPOINT.md` â€” implementation and continuation status.
2. `docs/PHASE9_EMAIL.md` â€” local email behavior and its limits.
3. `docs/PHASE9_VALIDATION.md` â€” observed results versus pending acceptance.
4. `docs/PHASE9_HANDOFF.md` â€” Windows update and private-demo instructions.

After backing up and preserving your existing private settings, from the
project root with Docker Desktop running:

```powershell
docker compose up -d --build --wait
```

Application: http://localhost:5173. Local test inbox: http://localhost:8025.

For the existing separate private demo:

```powershell
.\scripts\demo\Start-Demo.ps1
.\scripts\demo\Connect-Demo.ps1
```

Desktop demo: http://localhost:5180. Demo inbox: http://localhost:8026, accessible
only on the host computer. Keep the existing `.env.demo` and database/Tailscale
volumes. The connection script restores private phone access after rebuilding.
Do not publish or forward the inbox.

Platform administration stays at `/admin` with private provisioning and mandatory
MFA. There is no public admin registration. V7 enforces at most one platform
administrator per installation, independently of restaurant owners/managers.
