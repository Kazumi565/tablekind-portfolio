import { section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.TEST_APP_URL ?? "http://localhost:5173";
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const output = "test-results/operations-browser";
mkdirSync(output, { recursive: true });
try {
  await page.goto(base);
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_STAFF_PASSWORD ?? "Local-Review-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).waitFor();
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("staff")).accessToken,
  );
  async function post(path, body = {}) {
    const response = await page.request.post(base + "/api" + path, {
      headers: {
        Authorization: "Bearer " + token,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: body,
    });
    assert.equal(
      response.ok(),
      true,
      "Operational fixture request failed: " + response.status(),
    );
    return response.json();
  }
  const restaurant = await post("/restaurants", {
    name: "Status browser " + Date.now(),
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByLabel("Restaurant", { exact: true })
    .selectOption(restaurant.id);
  await section(page, "System status");
  await page
    .getByRole("heading", { name: "No active operational alerts", exact: true })
    .waitFor();
  await page.screenshot({
    path: output + "/desktop-status.png",
    fullPage: true,
  });
  checks.push(
    "Manager sees current operational counts and no false alerts for an unconfigured restaurant",
  );
  await page.route("**/api/restaurants/*/operations", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Database temporarily unavailable",
        code: "DATABASE_UNAVAILABLE",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Refresh system status", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Status unavailable" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", {
        name: "No active operational alerts",
        exact: true,
      })
      .count(),
    0,
  );
  checks.push(
    "An unavailable status endpoint clears stale healthy data and presents an explicit error",
  );
  await page.unroute("**/api/restaurants/*/operations");
  await page
    .getByRole("button", { name: "Refresh system status", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "No active operational alerts", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  await page.screenshot({ path: output + "/phone-status.png", fullPage: true });
  assert.deepEqual(errors, []);
  checks.push(
    "Status refresh recovers; phone layout fits without uncaught browser errors",
  );
  await post(`/restaurants/${restaurant.id}/pos/connect-test`);
  await post(`/restaurants/${restaurant.id}/pos/pause`, { paused: true });
  await page
    .getByRole("button", { name: "Refresh system status", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Needs attention", exact: true })
    .waitFor();
  await page.getByText("POS delivery is paused.", { exact: false }).waitFor();
  await page.screenshot({ path: output + "/phone-alert.png", fullPage: true });
  await post(`/restaurants/${restaurant.id}/pos/pause`, { paused: false });
  await page.waitForTimeout(2200);
  await page
    .getByRole("button", { name: "Refresh system status", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "No active operational alerts", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  checks.push(
    "Paused TEST POS raises a visible alert; resuming clears it without changing orders or payments",
  );
  const result = { status: "passed", checks };
  writeFileSync(
    output + "/results.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
