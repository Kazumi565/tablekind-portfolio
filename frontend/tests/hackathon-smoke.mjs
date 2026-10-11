import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Local configuration is read without printing passwords or tokens.
const config = Object.fromEntries(
  readFileSync(resolve("../.env.hackathon"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const n = line.indexOf("=");
      return [line.slice(0, n), line.slice(n + 1)];
    }),
);
assert.equal(
  config.AI_CALLS_ENABLED,
  "false",
  "This smoke test must run with paid AI disabled",
);
const base = process.env.TEST_APP_URL ?? config.HACKATHON_APP_URL;
const output = resolve("../test-results/hackathon-browser");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const guide = page.getByRole("region", { name: "Hackathon walkthrough" });
async function fits() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "No mobile overflow",
  );
}
try {
  await page.goto(base + "/manage");
  await page
    .getByLabel("Email", { exact: true })
    .fill(config.HACKATHON_STAFF_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(config.HACKATHON_STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await guide
    .getByRole("button", { name: "Start EUR dinner", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Split it in your own words" })
    .waitFor();
  const scenario = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("demoScenario")),
  );
  const api = async (path, guest = 0) => {
    const r = await context.request.get(
      base + `/api/sessions/${scenario.sessionId}${path}`,
      {
        headers: {
          Authorization: "Bearer " + scenario.guests[guest].accessToken,
        },
      },
    );
    assert.equal(r.status(), 200);
    return r.json();
  };
  const initial = await api("");
  assert.equal(initial.currency, "EUR");
  assert.equal(initial.bill.totalBani, 3801);
  assert.equal(initial.testPayments, false);
  assert.equal(initial.guests.length, 3);
  assert.ok(initial.items.every((i) => i.status === "ACCEPTED"));
  assert.ok(!(await page.locator("body").innerText()).includes("MDL"));
  await fits();
  await page.screenshot({
    path: resolve(output, "mobile-dinner.png"),
    fullPage: true,
  });
  checks.push(
    "Fresh isolated hackathon setup, authenticated EUR scenario, 38.01 EUR exact total, three diners, no simulator",
  );
  await page.getByRole("button", { name: "Preview split with AI" }).click();
  await page.getByRole("alert").first().waitFor();
  assert.equal((await api("")).bill.totalBani, 3801);
  checks.push("Disabled AI fails safely without a paid call or ledger change");

  // UI-only provider fixture: it never creates a server draft or financial proposal.
  const starter = initial.items.find(
    (i) => i.snapshot.names.en === "Shared starter",
  );
  const shares = initial.guests.map((g, n) => ({
    guestId: g.id,
    name: g.nickname,
    amountMinor: n < 2 ? 234 : 233,
  }));
  await page.route("**/ai-splits/preview", (route) =>
    route.fulfill({
      json: {
        status: "READY",
        revision: initial.session.revision,
        draftId: crypto.randomUUID(),
        currency: "EUR",
        summary: "Everyone shares the starter equally.",
        requiredGuestIds: initial.guests.map((g) => g.id),
        items: [
          {
            itemId: starter.id,
            name: "Shared starter",
            totalMinor: 701,
            shares,
          },
        ],
        totals: shares.map((s, n) => ({
          ...s,
          amountMinor: s.amountMinor + [1200, 1000, 900][n],
        })),
      },
    }),
  );
  await page.getByRole("button", { name: "Preview split with AI" }).click();
  await page.getByRole("heading", { name: "Resulting diner totals" }).waitFor();
  await fits();
  await page
    .getByRole("region", { name: "AI split assistant" })
    .screenshot({ path: resolve(output, "mobile-preview-fixture.png") });
  // A genuine concurrent table change invalidates this UI fixture's revision.
  const state = await api("");
  const response = await context.request.post(
    base + `/api/sessions/${scenario.sessionId}/help`,
    {
      headers: {
        Authorization: "Bearer " + scenario.guests[0].accessToken,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        revision: state.session.revision,
        reason: "Smoke test assistance",
      },
    },
  );
  assert.equal(response.status(), 200);
  await page
    .getByText("The table changed. Request and review a fresh preview.", {
      exact: true,
    })
    .waitFor({ timeout: 25000 });
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm preview and propose" })
      .isDisabled(),
    true,
  );
  await page.unroute("**/ai-splits/preview");
  checks.push(
    "UI fixture renders item shares and totals; real concurrent revision change disables stale confirmation",
  );
  for (const name of ["Diego", "Ana", "Mihai"]) {
    await guide.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("heading", { name: "Split it in your own words" })
      .waitFor();
    await fits();
  }
  await page.reload();
  await guide.getByRole("button", { name: "Mihai", exact: true }).click();
  await page
    .getByRole("heading", { name: "Split it in your own words" })
    .waitFor();
  await fits();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fits();
  await page.screenshot({
    path: resolve(output, "desktop-dinner.png"),
    fullPage: true,
  });
  checks.push(
    "Three diner switches, reload persistence, 390px mobile and 1440px desktop layout",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(output, "report.json"),
    JSON.stringify(
      { passed: true, checks, realAiCalls: 0, realPayPalCalls: 0 },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page.screenshot({
    path: resolve(output, "failure.png"),
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
