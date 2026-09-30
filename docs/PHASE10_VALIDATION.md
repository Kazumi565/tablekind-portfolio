# 0.10.2 implementation versus executed tests

## Implemented

- Guest camera button, local-frame native QR decoding with release of camera tracks, strict same-origin table-link parser, blocking **QR scanned successfully** dialog, automatic focus and scrolling to the nickname form after confirmation, visible **Joined Table X** confirmation, paste-link and external-phone-camera fallback; available without guest account.
- The private demo's existing eleven-step guide and start instructions now show how to try the QR exercise on two devices. No demo identity, volume, private access policy, payment or POS connector has changed.
- Source-only parser regression tests and a **new test script** for local Chromium that exercises a simulated camera, unsigned/foreign QR rejection, preview without joining, explicit anonymous join and unsupported-decoder fallback. The script creates a fictional local restaurant/table, not a production booking.

## Executed in this authoring environment (24 September 2026)

- `node --experimental-strip-types --test frontend/tests/table-code.test.mjs`: four parser cases passed.
- `node --check` on the new browser test script: passed syntax check.
- No native Docker/PostgreSQL suite, TypeScript production build, running-browser suite, Windows private demo or real phone camera test could be executed here: Docker, Maven and installed npm dependencies were unavailable. `npm ci --offline` could not resolve all dependencies from the local cache. **No pass claim is made** for those steps.
- Version 0.9.1 native results previously reported by the owner are historical; they do not certify 0.10.2.

## Acceptance to run on the Windows PC

1. Follow [START_PHASE10.md](../START_PHASE10.md); run the backend suite, frontend build, parser tests and `test:qr-camera` on the local fictional stack. Verify migration history stays V1–V9; no schema change was required.
2. For the demo, rebuild the same `tablekind-demo` stack with its retained `.env.demo` and volumes; run `npm.cmd --prefix frontend run test:demo` against `http://localhost:5180` with the existing demo staff password and Mailpit URL `http://localhost:8026`. This existing smoke checks the guided scenario, not a physical camera.
3. On a phone with Tailscale enabled, load the tailnet HTTPS `/guest` page and print an open demo table QR *from that tailnet address* on a second device. Confirm the button asks permission only after a tap, opens the rear camera if available, detects that code, turns off the camera, shows the correct restaurant/branch/table, and does **not** join until a nickname and Join tap. Try Stop camera, deny permission, refuse an unrelated QR, and try paste-link and the phone camera fallback. Repeat on Android and iPhone if available; record browser/device and unsupported-decoder result honestly.
4. Confirm a closed/disabled/rotated table link fails, scans never bypass staff/manager/admin permissions, and a guest switching tables gets the unpaid-share warning. Check narrow phone fit, visible text/focus and existing demo with Diego. Payment/POS are still TEST simulators; do not use actual funds or real bookings.

The locally mocked Chromium test verifies UI control flow, not native camera optics, physical QR quality, Safari/Firefox support, Tailscale policy or private-domain reachability. Production hosting/email/SMS are deferred.
