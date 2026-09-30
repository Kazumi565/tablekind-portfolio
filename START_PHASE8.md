# Start here — Tablekind 0.8.0

Phase 8 implements four interfaces, restaurant ownership and optional customer
accounts on top of the saved 0.7.2 reliability update.

Read these files before continuing:

1. `docs/PHASE8_CHECKPOINT.md` — completed implementation and continuation state.
2. `docs/PHASE8_ACCOUNTS.md` — identities, permissions, privacy and recovery limits.
3. `docs/PHASE8_VALIDATION.md` — observed checks and tests still awaiting execution.
4. `docs/PHASE8_HANDOFF.md` — Windows installation, private admin provisioning and acceptance.

| Interface | Local route | Access |
| --- | --- | --- |
| Platform administrator | `/admin` | Separate privately provisioned account, mandatory two-step sign-in |
| Restaurant management | `/manage` | Individual staff identity with OWNER or MANAGER membership |
| Waiter operations | `/staff` | Individual staff identity; service controls without management navigation |
| Guest | `/guest` or existing QR link | Anonymous joining; optional customer account |
| Customer account | `/guest/account` | Optional username/password sign-in and linked visits |

All URLs use your existing app origin, normally `http://localhost:5173` locally
or the existing private-demo address. No new host or deployment is required.

V6 is new. V1–V5, Compose files and existing demo scripts remain unchanged.
Back up before applying V6. No real money, live provider or public hosting is
introduced. Native backend/browser/outage/restore acceptance remains pending.
