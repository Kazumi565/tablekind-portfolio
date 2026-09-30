# Phase 7D checkpoint

Historical 0.7.2 checkpoint. Current progress is in docs/PHASE8_CHECKPOINT.md.

Source version 0.7.2, based exactly on the uploaded 0.7.1 source. Phase 7D operations are preserved, with focused request-recovery, cancellation-replay and TEST-profile payment fixes. Migrations V1–V5 are unchanged. No Git push or deployment has been performed.

Use START_PHASE7D.md and docs/PHASE7D_HANDOFF.md. Current progress and observed validation are in docs/RELIABILITY_CHECKPOINT.md and docs/RELIABILITY_VALIDATION.md. PHASE7D_VALIDATION.md records historical 0.7.1 evidence; do not treat implementation or a supplementary PGlite run as a native Docker/PostgreSQL pass.

Next acceptance gate: run the native backend suite (104 expected cases for this update) and scripts/ops/review.py on the user's PC, then browser tests/manual local/private-demo review. Preserve original secrets/database volumes and keep dumps out of Git. Real payment/POS/fiscal adapters and hosting remain blocked on the separate provider/restaurant decisions, not simulated as complete.
