import { section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const output = resolve("test-results/browser");
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
const pages = [],
  errors = [],
  checks = [];
async function page(viewport) {
  const c = await browser.newContext({ viewport });
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  pages.push(p);
  return p;
}
async function api(p, path, body, method = "POST") {
  return p.evaluate(
    async ({ path, body, method }) => {
      const token = JSON.parse(sessionStorage.getItem("staff")).accessToken;
      const response = await fetch("/api" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      return result;
    },
    { path, body, method },
  );
}
try {
  const staff = await page({ width: 1440, height: 1000 });
  await staff.goto(base);
  await staff
    .getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_STAFF_PASSWORD ?? "Local-Review-2026!");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await staff
    .getByRole("button", { name: "Restaurant setup", exact: true })
    .waitFor();
  checks.push("Staff sign-in");
  const restaurant = await api(staff, "/restaurants", {
    name: "Browser review " + Date.now(),
  });
  const prefix = "/restaurants/" + restaurant.id;
  const branch = await api(staff, prefix + "/branches", {
    name: "Browser branch",
    timezone: "Europe/Chisinau",
    approvalRequired: true,
    acceptingOrders: true,
    hours: [],
  });
  for (let i = 1; i <= 5; i++)
    await api(staff, prefix + "/branches/" + branch.id + "/tables", {
      label: "Table 0" + i,
      pilotEnabled: true,
      maxGuests: 20,
    });
  const category = await api(staff, prefix + "/categories", {
    names: { en: "Food" },
    sortOrder: 0,
  });
  await api(staff, prefix + "/products", {
    categoryId: category.id,
    names: { en: "Test pizza", ro: "Pizza de test", ru: "Тестовая пицца" },
    descriptions: { en: "A shared pizza for the test." },
    allergens: ["milk"],
    dietaryLabels: ["vegetarian"],
    priceBani: 10001,
    available: true,
  });
  await staff.getByRole("button", { name: "Refresh", exact: true }).click();
  await staff
    .getByLabel("Restaurant", { exact: true })
    .selectOption(restaurant.id);
  await section(staff, "Our table");
  await staff.getByRole("button", { name: "Table 01 Open table" }).click();
  const qr = staff.getByRole("dialog", { name: "Join this table" });
  await qr.waitFor();
  const joinUrl = await qr
    .getByLabel("Join link", { exact: true })
    .inputValue();
  const sessionId = await staff.evaluate(() =>
    sessionStorage.getItem("staffSessionId"),
  );
  await qr.getByRole("button", { name: "Close dialog" }).click();
  const mihai = await page({ width: 390, height: 844 });
  await mihai.goto(joinUrl);
  await mihai.getByLabel("Your nickname").fill("Mihai");
  await mihai.getByRole("button", { name: "Join table", exact: true }).click();
  await mihai
    .getByRole("heading", { name: "Something for everyone" })
    .waitFor();
  const diego = await page({ width: 390, height: 844 });
  await diego.goto(joinUrl);
  await diego.getByLabel("Your nickname").fill("Diego");
  let dropJoin = true;
  await diego.route("**/api/join", async (route) => {
    if (dropJoin) {
      dropJoin = false;
      assert.ok(
        (await route.fetch()).ok(),
        "Original join must commit successfully",
      );
      await route.abort("failed");
    } else await route.continue();
  });
  await diego.getByRole("button", { name: "Join table", exact: true }).click();
  await diego
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor();
  const lostJoin = await diego.evaluate(() =>
    sessionStorage.getItem("tablekind.pendingCommand.v1"),
  );
  await diego.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await diego.reload();
  assert.equal(
    await diego.evaluate(() =>
      sessionStorage.getItem("tablekind.pendingCommand.v1"),
    ),
    lostJoin,
  );
  await diego
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  await diego
    .getByRole("heading", { name: "Something for everyone" })
    .waitFor();
  checks.push(
    "Lost join response survives reload and retries the original guest identity",
  );
  await staff.getByText("2 guests", { exact: true }).first().waitFor();
  checks.push("Two independent guests join and update staff live");
  await mihai.getByRole("button", { name: "Order", exact: true }).click();
  let dropOrder = true;
  let originalOrderRequest;
  await mihai.route("**/api/sessions/*/orders", async (route) => {
    if (dropOrder) {
      dropOrder = false;
      originalOrderRequest = {
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      };
      assert.ok(
        (await route.fetch()).ok(),
        "Original order must commit successfully",
      );
      await route.abort("failed");
    } else {
      assert.equal(
        route.request().headers()["idempotency-key"],
        originalOrderRequest.key,
      );
      assert.equal(route.request().postData(), originalOrderRequest.body);
      await route.continue();
    }
  });
  await mihai
    .getByRole("button", { name: "Submit order · 100.01 MDL", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor();
  await mihai.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await mihai.reload();
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    (await api(staff, "/sessions/" + sessionId, undefined, "GET")).items.length,
    1,
  );
  await mihai.unroute("**/api/sessions/*/orders");
  checks.push(
    "Lost order response survives reload with identical key/body and no duplicate order",
  );
  await staff
    .getByRole("button", { name: "Accept order", exact: true })
    .click();
  for (const p of [mihai, diego]) await section(p, "Pay & split");
  await diego.getByText("Everyone's shares", { exact: true }).click();
  await mihai
    .getByRole("button", { name: "Share or transfer", exact: true })
    .click();
  await mihai
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Diego" })
    .check();
  await mihai
    .getByRole("button", { name: "Propose allocation", exact: true })
    .click();
  await diego
    .getByRole("button", { name: "Agree to my share", exact: true })
    .waitFor();
  assert.match(
    await diego
      .locator(".guest-balances .balance")
      .filter({ hasText: "Diego" })
      .innerText(),
    /0\.00 MDL/,
  );
  await diego
    .getByRole("button", { name: "Agree to my share", exact: true })
    .click();
  await mihai
    .getByText("Agreement needed", { exact: true })
    .waitFor({ state: "hidden" });
  await mihai.waitForFunction(() =>
    document.querySelector(".guest-balances")?.textContent?.includes("50.0"),
  );
  checks.push(
    "Ordering, staff acceptance and shared-food consent with exact odd-ban rounding",
  );
  await mihai
    .getByText("Pay for others or enter a custom amount", { exact: true })
    .click();
  await mihai.getByLabel("Custom amount in MDL (optional)").fill("20");
  await mihai
    .getByLabel("Payment method", { exact: true })
    .selectOption("CARD");
  await mihai
    .getByRole("button", { name: "Calculate checkout", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Start TEST checkout", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Cancel checkout", exact: true })
    .waitFor();
  await diego.waitForFunction(() =>
    document
      .querySelectorAll(".metrics .card")[1]
      ?.textContent?.includes("20.00"),
  );
  await diego
    .getByRole("button", { name: "I'll cover this", exact: true })
    .click();
  await diego
    .getByRole("alert")
    .filter({ hasText: "locked by a checkout reservation" })
    .waitFor();
  checks.push("Pending payment prevents competing item takeover");
  await mihai.reload();
  await section(mihai, "Pay & split");
  await mihai
    .getByRole("button", { name: "Cancel checkout", exact: true })
    .click();
  await mihai.getByText("cancelled", { exact: true }).first().waitFor();
  await diego.getByRole("button", { name: "Refresh", exact: true }).click();
  await diego.getByText("Other guests' payments", { exact: true }).click();
  await diego.getByLabel("Show the whole table", { exact: true }).check();
  await diego.getByText("cancelled", { exact: true }).first().waitFor();
  await diego
    .getByRole("button", { name: "I'll cover this", exact: true })
    .click();
  const covered = () =>
    [...document.querySelectorAll(".guest-balances .balance")].some(
      (e) =>
        e.textContent.includes("Diego") && e.textContent.includes("100.01"),
    );
  await diego.waitForFunction(covered);
  await mihai.getByRole("button", { name: "Refresh", exact: true }).click();
  await mihai.waitForFunction(covered);
  checks.push(
    "Reload preserves pending payment; confirmed cancellation permits takeover",
  );

  await mihai
    .getByText("Pay for others or enter a custom amount", { exact: true })
    .click();
  await mihai.getByLabel("Cover", { exact: true }).selectOption("REMAINDER");
  await mihai.getByLabel("Custom amount in MDL (optional)").fill("20");
  await mihai
    .getByLabel("Payment method", { exact: true })
    .selectOption("CARD");
  const before = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  let drop = true;
  await mihai.route("**/api/sessions/*/payments", async (route) => {
    if (drop) {
      drop = false;
      assert.ok(
        (await route.fetch()).ok(),
        "Original payment must commit successfully",
      );
      await route.abort("failed");
    } else await route.continue();
  });
  await mihai
    .getByRole("button", { name: "Calculate checkout", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Start TEST checkout", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor();
  const lostPayment = await mihai.evaluate(() =>
    sessionStorage.getItem("tablekind.pendingCommand.v1"),
  );
  await mihai.waitForFunction(
    () => document.querySelector("main")?.getAttribute("aria-busy") === "false",
  );
  await mihai.reload();
  assert.equal(
    await mihai.evaluate(() =>
      sessionStorage.getItem("tablekind.pendingCommand.v1"),
    ),
    lostPayment,
  );
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  await mihai
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor({ state: "hidden" });
  let after = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  assert.equal(after.payments.length, before.payments.length + 1);
  assert.equal(after.bill.reservedBani, 2000);
  assert.equal(after.bill.paidBani, 0);
  const cardId = after.payments.find((p) => p.status === "PENDING").id;
  checks.push(
    "Lost payment-start response survives reload, retries the same key and creates one attempt",
  );

  await section(mihai, "Pay & split");

  const card = mihai.locator('[data-payment-id="' + cardId + '"]');
  await card.getByText("Open TEST checkout", { exact: true }).click();
  await card.getByLabel("Deliver signed notification immediately").uncheck();
  await card
    .getByRole("button", { name: "Simulate payment outcome", exact: true })
    .click();
  await mihai.getByRole("button", { name: "Refresh", exact: true }).click();
  after = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  assert.equal(after.bill.paidBani, 0);
  assert.equal(after.bill.reservedBani, 2000);
  await card
    .getByRole("button", { name: "Check provider status", exact: true })
    .click();
  await card.getByText("succeeded", { exact: true }).waitFor();
  after = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  assert.equal(after.bill.paidBani, 2000);
  assert.equal(after.bill.reservedBani, 0);
  checks.push(
    "Delayed signed notification recovers via provider lookup without duplicate settlement",
  );

  await diego.getByRole("button", { name: "Refresh", exact: true }).click();
  await diego.waitForFunction(() =>
    document
      .querySelectorAll(".metrics .card")[2]
      ?.textContent?.includes("20.00"),
  );
  await diego
    .getByLabel("Payment method", { exact: true })
    .selectOption("CASH");
  await diego.getByLabel("Optional tip in MDL").fill("5");
  await diego
    .getByRole("button", { name: "Calculate checkout", exact: true })
    .click();
  await diego
    .getByRole("button", { name: "Request cash collection", exact: true })
    .click();
  await diego
    .getByText("Wait for the waiter to collect and confirm your cash.", {
      exact: false,
    })
    .waitFor();
  await staff
    .getByRole("button", { name: "Bill & sharing", exact: true })
    .click();
  await staff.getByRole("button", { name: "Refresh", exact: true }).click();
  await staff.getByLabel("Cash received in MDL").fill("90");
  await staff.getByLabel("I received the cash and returned the change").check();
  await staff
    .getByRole("button", { name: "Confirm cash received", exact: true })
    .click();
  await staff.getByText(/Change returned: 4.99 MDL/).waitFor();
  after = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  assert.equal(after.bill.paidBani, 10001);
  assert.equal(after.bill.remainingBani, 0);
  checks.push(
    "Mixed card/cash collection records agreed tip and correct cash change",
  );

  await staff
    .locator('[data-payment-id="' + cardId + '"]')
    .getByRole("button", { name: "Request refund", exact: true })
    .click();
  const refundForm = staff.getByRole("region", {
    name: "Request refund",
    exact: true,
  });
  await refundForm
    .getByLabel("Refund reason")
    .fill("Returned shared food portion");
  await refundForm
    .getByRole("button", { name: "Create refund request", exact: true })
    .click();
  await staff.getByText("Open TEST refund", { exact: true }).click();
  await staff
    .getByRole("button", { name: "Simulate refund outcome", exact: true })
    .click();
  await staff
    .getByRole("button", { name: "Refresh reconciliation", exact: true })
    .click();
  await staff.getByText("Ledger matches", { exact: true }).waitFor();
  after = await api(staff, "/sessions/" + sessionId, undefined, "GET");
  assert.equal(after.bill.paidBani, 8001);
  assert.equal(after.bill.totalBani, 8001);
  assert.equal(after.bill.remainingBani, 0);
  checks.push(
    "Manager refund preserves allocation and reconciliation matches the reduced bill",
  );
  await mihai.getByRole("button", { name: "Refresh", exact: true }).click();
  await card
    .getByRole("button", { name: "View confirmation", exact: true })
    .click();
  await mihai
    .getByRole("region", { name: "Payment confirmation", exact: true })
    .waitFor();
  await mihai.getByText("Not a fiscal receipt.", { exact: false }).waitFor();
  checks.push(
    "Guest receives a clearly labelled test confirmation, not a fiscal receipt",
  );
  for (const p of [mihai, diego, staff])
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Horizontal page overflow",
    );
  checks.push("Desktop and mobile pages fit their viewport");
  await mihai.screenshot({
    path: resolve(output, "guest-bill-mobile.png"),
    fullPage: true,
  });
  await staff.screenshot({
    path: resolve(output, "staff-table-desktop.png"),
    fullPage: true,
  });
  await staff
    .getByRole("button", { name: "Restaurant setup", exact: true })
    .click();
  await staff
    .getByRole("button", { name: "branches & tables", exact: true })
    .click();
  await staff.getByLabel("Limit ordering to kitchen opening hours").check();
  await staff
    .getByRole("button", { name: "Add opening period", exact: true })
    .click();
  await staff.getByLabel("Opens", { exact: true }).fill("09:00");
  await staff.getByRole("button", { name: "Save branch", exact: true }).click();
  await staff.getByRole("button", { name: "menu", exact: true }).click();
  await staff.getByRole("button", { name: "Modifiers", exact: true }).click();
  await staff
    .getByRole("button", { name: "Add option group", exact: true })
    .click();
  await staff.getByLabel("Group name (en)", { exact: true }).fill("Toppings");
  await staff.getByLabel("Option 1 (en)", { exact: true }).fill("Extra cheese");
  await staff.getByLabel("Extra price in MDL", { exact: true }).fill("10.00");
  await staff
    .getByRole("button", { name: "Save options", exact: true })
    .click();
  await staff.getByRole("dialog").waitFor({ state: "hidden" });
  const setup = await api(staff, prefix, undefined, "GET");
  assert.equal(setup.branches[0].hours[0].opens, "09:00");
  assert.equal(
    setup.menu.products[0].modifierGroups[0].options[0].price_bani,
    1000,
  );
  checks.push(
    "Manager configures opening hours and product options through normal forms",
  );
  assert.deepEqual(errors, []);
  checks.push("No uncaught browser JavaScript errors");
  writeFileSync(
    resolve(output, "result.json"),
    JSON.stringify({ status: "passed", checks }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (error) {
  for (let i = 0; i < pages.length; i++)
    await pages[i]
      .screenshot({ path: resolve(output, `failure-${i}.png`), fullPage: true })
      .catch(() => {});
  writeFileSync(
    resolve(output, "result.json"),
    JSON.stringify(
      { status: "failed", checks, error: error.message, browserErrors: errors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
