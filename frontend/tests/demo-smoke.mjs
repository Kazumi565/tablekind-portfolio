import { emailCode, section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.TEST_APP_URL ?? "http://localhost:5180";
const password = process.env.TEST_STAFF_PASSWORD;
if (!password)
  throw new Error(
    "Set TEST_STAFF_PASSWORD to the isolated demo's staff password.",
  );
const output = resolve("test-results/demo-browser");
mkdirSync(output, { recursive: true });
const custom = process.env.CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({
  headless: true,
  executablePath: custom || undefined,
  args: custom
    ? [
        "--no-sandbox",
        "--no-zygote",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ]
    : [],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const guide = page.getByRole("region", { name: "Practice walkthrough" });
let staff;
async function api(
  path,
  method = "GET",
  token = staff,
  key = crypto.randomUUID(),
) {
  return context.request.fetch(base + "/api" + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Idempotency-Key": key,
    },
    ...(method === "GET" ? {} : { data: {} }),
  });
}
async function advance() {
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await guide
    .getByRole("button", { name: "Open this step", exact: true })
    .click();
}
async function fits() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
}
try {
  const config = await api("/demo/config", "GET", null);
  assert.equal(
    config.status(),
    200,
    "This test must run against the isolated demo profile.",
  );
  assert.equal((await config.json()).enabled, true);
  assert.equal((await api("/demo/scenarios", "POST", null)).status(), 401);
  await page.goto(base);
  await guide.waitFor();
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "demo@tablekind.local");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await guide
    .getByRole("button", { name: "Start practice table", exact: true })
    .waitFor();
  staff = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("staff")).accessToken,
  );
  // Simulate a successful creation whose response never reaches the phone, then reload/retry.
  let dropped = false;
  let firstScenario;
  await page.route("**/api/demo/scenarios", async (route) => {
    if (!dropped) {
      dropped = true;
      const response = await route.fetch();
      firstScenario = await response.json();
      await route.abort("failed");
    } else await route.continue();
  });
  await guide
    .getByRole("button", { name: "Start practice table", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "retry" }).waitFor();
  await page.reload();
  await guide
    .getByRole("button", { name: "Start practice table", exact: true })
    .click();
  await page.getByRole("heading", { name: "Something for everyone" }).waitFor();
  await page.getByRole("button", { name: "Scan table QR" }).waitFor();
  checks.push("Guest demo shows an optional account-free QR camera button and link fallback");
  let scenario = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("demoScenario")),
  );
  assert.equal(scenario.sessionId, firstScenario.sessionId);
  assert.equal(
    (
      await api("/demo/scenarios", "POST", scenario.guests[0].accessToken)
    ).status(),
    403,
  );
  checks.push(
    "Demo manager creates one practice table despite lost response and reload; guests cannot create scenarios",
  );
  // Reopening the current step must not leave the existing session blank.
  await guide
    .getByRole("button", { name: "Open this step", exact: true })
    .click();
  await page.getByRole("heading", { name: "Something for everyone" }).waitFor();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Shared pizza", exact: true }),
    })
    .getByRole("button", { name: "Order", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit order · 181.01 MDL", exact: true })
    .click();
  await advance();
  await page.getByRole("button", { name: "Accept order", exact: true }).click();
  await advance();
  await page
    .getByRole("button", { name: "Share or transfer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Diego", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Propose allocation", exact: true })
    .click();
  await advance();
  await page
    .getByRole("button", { name: "Agree to my share", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agree to my share", exact: true })
    .waitFor({ state: "hidden" });
  let state = await (await api("/sessions/" + scenario.sessionId)).json();
  assert.deepEqual(
    state.bill.guests.map((g) => g.allocated_bani).sort(),
    [9050, 9051],
  );
  checks.push(
    "One phone switches between two guests and staff for ordering, approval and exact shared-food consent",
  );
  await page.reload();
  await guide.getByText(/Step 4 of 11/).waitFor();
  assert.equal(
    await guide
      .getByRole("button", { name: "Diego", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await fits();
  await page.screenshot({ path: output + "/phone-guide.png", fullPage: true });
  checks.push(
    "Reload retains the practice scenario, selected guest and walkthrough progress",
  );
  await advance();
  await page.getByLabel("Payment method", { exact: true }).selectOption("CARD");
  await page
    .getByRole("button", { name: "Calculate checkout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start TEST checkout", exact: true })
    .click();
  await page.getByText("Open TEST checkout", { exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate payment outcome", exact: true })
    .click();
  await page.getByText("succeeded", { exact: true }).waitFor();
  await advance();
  await page.getByLabel("Payment method", { exact: true }).selectOption("CASH");
  await page
    .getByRole("button", { name: "Calculate checkout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Request cash collection", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm cash received", exact: true })
      .count(),
    0,
  );
  await advance();
  await page.getByLabel("Cash received in MDL").fill("100");
  await page.getByLabel("I received the cash and returned the change").check();
  await page
    .getByRole("button", { name: "Confirm cash received", exact: true })
    .click();
  await page.getByText(/Change returned: 9\.(49|50) MDL/).waitFor();
  state = await (await api("/sessions/" + scenario.sessionId)).json();
  assert.equal(state.bill.totalBani, 18101);
  assert.equal(state.bill.paidBani, 18101);
  assert.equal(state.bill.remainingBani, 0);
  checks.push(
    "Guided card and staff-confirmed cash payments settle exactly, including cash change",
  );
  await advance();
  await page
    .getByRole("heading", { name: "TEST POS · Active", exact: true })
    .waitFor();
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    state = await (await api("/sessions/" + scenario.sessionId)).json();
    if (state.pos?.pending === 0 && state.pos?.failed === 0) break;
    await page.waitForTimeout(300);
  }
  const reconciliation = await api(
    `/restaurants/${scenario.restaurantId}/pos/sessions/${scenario.sessionId}/reconcile`,
    "POST",
  );
  assert.equal(reconciliation.status(), 200);
  const pos = await reconciliation.json();
  assert.equal(pos.status, "MATCH", JSON.stringify(pos));
  await fits();
  await page.screenshot({ path: output + "/phone-pos.png", fullPage: true });
  checks.push(
    "The practice table is tracked from creation and reconciles with the TEST POS",
  );
  await advance();
  await page
    .getByRole("heading", { name: "Restaurant setup", exact: true })
    .waitFor();
  await advance();
  const account = page.locator(".customer-panel");
  await account
    .getByRole("button", { name: "Create optional account", exact: true })
    .click();
  const username = "demo_" + Date.now();
  const email = username + "@example.test";
  await account.getByLabel("Username", { exact: true }).fill(username);
  await account.getByLabel("Email address", { exact: true }).fill(email);
  await account.getByLabel("Display name", { exact: true }).fill("Demo guest");
  await account
    .getByLabel("New account password", { exact: true })
    .fill("Demo-Account-Fixture!");
  await account
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  await account
    .getByRole("button", { name: "I saved my recovery code", exact: true })
    .click();
  await account
    .getByLabel("Email verification code", { exact: true })
    .fill(await emailCode(email));
  await account
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  await account
    .getByText("Email verified in this demo", { exact: true })
    .waitFor();
  await account
    .getByRole("button", { name: "Link my current table", exact: true })
    .click();
  await account
    .getByText("Your current table is linked to this account.", { exact: true })
    .waitFor();
  await fits();
  checks.push(
    "Steps 9 and 10 open management and verify an optional guest account through local Mailpit",
  );
  await advance();
  await page
    .locator(".practice-reservations")
    .getByRole("heading", { name: "Try a reservation request" })
    .waitFor();
  const reservationPanel = page.locator(".practice-reservations");
  await reservationPanel
    .getByLabel("Requested date and time (your device time)")
    .fill(
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    );
  await reservationPanel
    .getByRole("button", { name: "Send practice request" })
    .click();
  await reservationPanel
    .locator(".practice-reservation-list li")
    .first()
    .waitFor();
  await guide.getByRole("button", { name: "Manager", exact: true }).click();
  await section(page, "Practice reservations");
  await reservationPanel
    .getByRole("button", { name: "Practice approve" })
    .click();
  await reservationPanel
    .getByText("practice approved", { exact: false })
    .waitFor();
  await guide.getByRole("button", { name: "Mihai", exact: true }).click();
  await guide.getByRole("button", { name: "Open this step" }).click();
  await reservationPanel
    .getByText("practice approved", { exact: false })
    .waitFor();
  checks.push(
    "Step 11 sends a fictional reservation and shows a manager practice approval without reserving a real table",
  );
  await guide.getByText("Try more or start again", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await guide
    .getByRole("button", { name: "Start a fresh practice table", exact: true })
    .click();
  await page.getByRole("heading", { name: "Something for everyone" }).waitFor();
  const fresh = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("demoScenario")),
  );
  assert.notEqual(fresh.sessionId, scenario.sessionId);
  const old = await (await api("/sessions/" + scenario.sessionId)).json();
  assert.equal(old.bill.paidBani, 18101);
  checks.push(
    "Starting over creates a fresh table and preserves the previous settled table",
  );
  await page
    .getByRole("button", { name: "Sign out on this tab", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() =>
      ["staff", "guest", "demoScenario", "demoStartKey"].every(
        (k) => sessionStorage.getItem(k) === null,
      ),
    ),
    true,
  );
  await fits();
  assert.deepEqual(errors, []);
  checks.push(
    "Sign-out removes all demo roles; mobile screens fit without uncaught browser errors",
  );
  writeFileSync(
    output + "/results.json",
    JSON.stringify({ status: "passed", checks }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (error) {
  await page
    .screenshot({ path: output + "/failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
