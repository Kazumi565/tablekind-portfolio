# Phase 7D reliability update — version 0.7.2

Historical 0.7.2 entry point. For the current 0.8.0 package, use START_PHASE8.md.

Start with [docs/PHASE7D_HANDOFF.md](docs/PHASE7D_HANDOFF.md) for the Windows update and test commands.

This update preserves Phase 7D operations and adds ordinary request recovery across reload, correct waiter cancellation replay and rejection of payment mutations in unconfigured profiles. V1–V5 and all Compose/Tailscale configuration are unchanged. Existing payments, POS and the private phone demo remain TEST-only.

The source is implemented; native Docker/PostgreSQL verification is still required on your PC before calling Phase 7D verified. See [docs/RELIABILITY_VALIDATION.md](docs/RELIABILITY_VALIDATION.md) for this update and [docs/RELIABILITY_CHECKPOINT.md](docs/RELIABILITY_CHECKPOINT.md) for continuation. Earlier evidence remains in PHASE7D_VALIDATION.md. Nothing has been deployed or pushed to GitHub.

Keep your existing Git history, environment files, signing secrets, database volumes and Tailscale policy. Do not replace secrets or use `down --volumes` on your working local/demo stack.
